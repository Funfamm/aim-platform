import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getRoomServiceClient } from '@/lib/livekit/server'

// GET /api/livekit/rooms — list all live events (admin only)
export async function GET(req: Request) {
    try {
        await requireAdmin()

        const { searchParams } = new URL(req.url)
        const status = searchParams.get('status') // optional filter
        const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

        const events = await prisma.liveEvent.findMany({
            where: status ? { status } : undefined,
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true,
                title: true,
                roomName: true,
                status: true,
                eventType: true,
                hostUserId: true,
                projectId: true,
                castingCallId: true,
                recordingUrl: true,
                egressId: true,
                captionsActive: true,
                startedAt: true,
                endedAt: true,
                createdAt: true,
            },
        })

        // For live rooms — fetch real-time participant count from LiveKit in parallel.
        // Each call is raced against a 4 s timeout so a slow/unreachable LiveKit server
        // can never hang the entire admin page response.
        const liveRoomNames = events
            .filter(e => e.status === 'live')
            .map(e => e.roomName)

        const participantCounts: Record<string, number> = {}

        if (liveRoomNames.length > 0) {
            const roomSvc = getRoomServiceClient()

            // Helper: race a promise against a timeout, resolving to a fallback on expiry
            const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
                Promise.race([
                    promise,
                    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
                ])

            // Rooms confirmed by LiveKit as genuinely not found — self-heal these in DB
            const orphanedRooms: string[] = []

            await Promise.allSettled(
                liveRoomNames.map(async (roomName) => {
                    try {
                        const participants = await withTimeout(
                            roomSvc.listParticipants(roomName),
                            4_000,   // 4 s per room — keeps total well under Vercel's limit
                            null,    // null sentinel = timeout (do NOT self-heal on timeout)
                        )
                        if (participants === null) {
                            // Timed out — default to 0, don't self-heal (could be transient)
                            participantCounts[roomName] = 0
                        } else {
                            participantCounts[roomName] = participants.length
                        }
                    } catch (err) {
                        const msg = String(err)
                        // Only self-heal on *explicit* "room not found" responses from LiveKit.
                        // Never self-heal on network errors, timeouts, or 5xx — those are
                        // transient and would incorrectly mark an active room as 'ended'.
                        const isNotFound =
                            msg.includes('room not found') ||
                            msg.includes('room_not_found') ||
                            // LiveKit Cloud gRPC: status code 5 = NOT_FOUND
                            msg.includes('status code 5') ||
                            msg.includes('NOT_FOUND')
                        // Explicitly exclude network-level errors from orphan detection
                        const isNetworkError =
                            msg.includes('ECONNREFUSED') ||
                            msg.includes('ETIMEDOUT') ||
                            msg.includes('fetch failed') ||
                            msg.includes('5')&&msg.includes('00') // 500-599 HTTP codes
                        if (isNotFound && !isNetworkError) {
                            orphanedRooms.push(roomName)
                            console.warn(`[rooms/GET] room '${roomName}' confirmed not found on LiveKit — self-healing to 'ended'`)
                        } else {
                            // Transient error — log but leave DB status unchanged
                            console.warn(`[rooms/GET] listParticipants failed for '${roomName}' (transient):`, msg.slice(0, 200))
                        }
                        participantCounts[roomName] = 0
                    }
                })
            )

            // Self-heal: mark genuinely orphaned rooms as 'ended' so the dashboard stays accurate
            if (orphanedRooms.length > 0) {
                await prisma.liveEvent.updateMany({
                    where: { roomName: { in: orphanedRooms }, status: 'live' },
                    data: { status: 'ended', endedAt: new Date() },
                }).catch(() => { /* non-critical — dashboard still shows stale data at worst */ })
            }
        }

        const eventsWithCounts = events.map(e => ({
            ...e,
            participantCount: participantCounts[e.roomName] ?? 0,
        }))

        return NextResponse.json({ events: eventsWithCounts })
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Internal server error'
        const status = msg === 'Unauthorized' ? 401 : msg.startsWith('Forbidden') ? 403 : 500
        return NextResponse.json({ error: msg }, { status })
    }
}
