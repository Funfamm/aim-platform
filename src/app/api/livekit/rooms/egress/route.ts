import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getEgressClient } from '@/lib/livekit/server'
import { prisma } from '@/lib/db'
import { EncodedFileType, EncodedFileOutput, SegmentedFileOutput, SegmentedFileProtocol } from 'livekit-server-sdk'

/**
 * POST /api/livekit/rooms/egress
 *
 * Starts a LiveKit egress session for a given room.
 * Supports two output modes controlled by `outputType`:
 *   - "mp4"  — single MP4 file uploaded to R2 after the room ends
 *   - "hls"  — chunked HLS stream for live playback (segments to R2)
 *
 * The egress ID is persisted in `LiveEvent.egressId` so we can:
 *   - Stop it via DELETE /api/livekit/rooms/egress
 *   - Track completion in the webhook handler
 */
export async function POST(req: Request) {
    try {
        await requireAdmin()

        const body = await req.json() as {
            roomName: string
            outputType?: 'mp4' | 'hls'
            layout?: string
        }

        const { roomName, outputType = 'mp4', layout = 'grid' } = body

        if (!roomName) {
            return NextResponse.json({ error: 'roomName is required' }, { status: 400 })
        }

        // Verify room exists and is live
        const event = await prisma.liveEvent.findUnique({
            where: { roomName },
            select: { id: true, status: true, egressId: true, title: true },
        })

        if (!event) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 })
        }
        if (event.status !== 'live') {
            return NextResponse.json(
                { error: `Room must be live to start recording (current: ${event.status})` },
                { status: 409 },
            )
        }
        if (event.egressId) {
            return NextResponse.json(
                { error: 'Recording already in progress', egressId: event.egressId },
                { status: 409 },
            )
        }

        // Validate all R2 credentials are configured before calling LiveKit.
        // Missing vars default to '' which causes LiveKit to start an egress that
        // silently fails to upload — leaving a dangling egressId with no recording.
        const r2MissingVars = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_ENDPOINT']
            .filter((k) => !process.env[k])
        if (r2MissingVars.length > 0) {
            return NextResponse.json(
                { error: `R2 storage not fully configured. Missing: ${r2MissingVars.join(', ')}` },
                { status: 503 },
            )
        }

        // Build R2 S3-compatible storage config (S3Upload shape)
        const r2Storage = {
            accessKey: process.env.R2_ACCESS_KEY_ID ?? '',
            secret: process.env.R2_SECRET_ACCESS_KEY ?? '',
            bucket: process.env.R2_BUCKET_NAME ?? '',
            region: 'auto',
            endpoint: process.env.R2_ENDPOINT ?? '',
            forcePathStyle: true,
        }

        const timestamp = Date.now()
        const egressClient = getEgressClient()
        const opts = { layout }

        let egressId: string

        if (outputType === 'hls') {
            // HLS: chunked segments uploaded live to R2 — viewable during the event
            const output = new SegmentedFileOutput({
                protocol: SegmentedFileProtocol.HLS_PROTOCOL,
                filenamePrefix: `recordings/${roomName}-${timestamp}/segment`,
                playlistName: `${roomName}.m3u8`,
                livePlaylistName: `${roomName}-live.m3u8`,
                segmentDuration: 6,
                output: { case: 's3', value: r2Storage },
            })
            const info = await egressClient.startRoomCompositeEgress(roomName, output, opts)
            egressId = info.egressId
        } else {
            // MP4: single composite file, finalized when egress stops
            const output = new EncodedFileOutput({
                fileType: EncodedFileType.MP4,
                filepath: `recordings/${roomName}-${timestamp}.mp4`,
                output: { case: 's3', value: r2Storage },
            })
            const info = await egressClient.startRoomCompositeEgress(roomName, output, opts)
            egressId = info.egressId
        }

        // Persist egressId so we can stop it and the webhook can match it
        await prisma.liveEvent.update({
            where: { roomName },
            data: { egressId },
        })

        console.info(`[egress] Started ${outputType} egress for ${roomName} — egressId: ${egressId}`)

        return NextResponse.json({ ok: true, egressId, outputType, roomName })
    } catch (error) {
        console.error('[egress/start] error', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * DELETE /api/livekit/rooms/egress
 *
 * Stops the active egress session for a room.
 * LiveKit will finalize the file and emit an egress_ended webhook
 * which sets LiveEvent.recordingUrl automatically.
 */
export async function DELETE(req: Request) {
    try {
        await requireAdmin()

        const { roomName } = await req.json() as { roomName: string }

        if (!roomName) {
            return NextResponse.json({ error: 'roomName is required' }, { status: 400 })
        }

        const event = await prisma.liveEvent.findUnique({
            where: { roomName },
            select: { egressId: true },
        })

        if (!event?.egressId) {
            return NextResponse.json({ error: 'No active recording found for this room' }, { status: 404 })
        }

        const egressClient = getEgressClient()
        await egressClient.stopEgress(event.egressId)

        // Clear egressId — recordingUrl will be set by the webhook on egress_ended
        await prisma.liveEvent.update({
            where: { roomName },
            data: { egressId: null },
        })

        console.info(`[egress] Stopped egress ${event.egressId} for ${roomName}`)

        return NextResponse.json({ ok: true, roomName })
    } catch (error) {
        console.error('[egress/stop] error', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * GET /api/livekit/rooms/egress?roomName=...
 *
 * Returns all egress sessions for a room (active + completed).
 * Used by the admin events panel to show recording status.
 */
export async function GET(req: Request) {
    try {
        await requireAdmin()

        const { searchParams } = new URL(req.url)
        const roomName = searchParams.get('roomName')

        if (!roomName) {
            return NextResponse.json({ error: 'roomName query param required' }, { status: 400 })
        }

        const egressClient = getEgressClient()
        const sessions = await egressClient.listEgress({ roomName })

        return NextResponse.json({ sessions })
    } catch (error) {
        console.error('[egress/list] error', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
