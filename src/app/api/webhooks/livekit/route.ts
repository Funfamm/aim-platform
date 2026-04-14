import { NextResponse } from 'next/server'
import { receiveLiveKitWebhook } from '@/lib/livekit/webhook'
import { prisma } from '@/lib/db'

// LiveKit requires the raw body string for signature verification.
// Do NOT use NextRequest.json() — read as text first.
export async function POST(req: Request) {
    try {
        const rawBody = await req.text()
        const authHeader = req.headers.get('authorization') ?? undefined

        const event = await receiveLiveKitWebhook(rawBody, authHeader)

        switch (event.event) {
            case 'room_started': {
                const roomName = event.room?.name
                if (roomName) {
                    await prisma.liveEvent.updateMany({
                        where: { roomName, status: { not: 'ended' } },
                        data: { status: 'live', startedAt: new Date() },
                    })

                    // Auto-trigger caption worker — fire-and-forget
                    // If CAPTION_WORKER_URL is not set (dev / pre-Phase-3), this is a no-op.
                    const workerUrl = process.env.CAPTION_WORKER_URL
                    const workerSecret = process.env.WORKER_WEBHOOK_SECRET
                    if (workerUrl && workerSecret) {
                        fetch(`${workerUrl}/start-session`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Worker-Secret': workerSecret,
                            },
                            body: JSON.stringify({ roomName, startedAt: new Date().toISOString() }),
                            signal: AbortSignal.timeout(5_000),
                        }).catch((err) => {
                            console.warn('[livekit/webhook] Caption worker trigger failed', err.message)
                        })
                    }
                }
                break
            }

            case 'room_finished': {
                const roomName = event.room?.name
                if (roomName) {
                    await prisma.liveEvent.updateMany({
                        where: { roomName },
                        data: { status: 'ended', endedAt: new Date(), captionsActive: false },
                    })
                    // Tell caption worker to disconnect — fire-and-forget
                    const workerUrl = process.env.CAPTION_WORKER_URL
                    const workerSecret = process.env.WORKER_WEBHOOK_SECRET
                    if (workerUrl && workerSecret) {
                        fetch(`${workerUrl}/stop-session`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'X-Worker-Secret': workerSecret },
                            body: JSON.stringify({ roomName }),
                            signal: AbortSignal.timeout(5_000),
                        }).catch(() => {})
                    }
                }
                break
            }

            case 'participant_joined':
            case 'participant_left': {
                // Analytics: log participant activity
                console.info(`[livekit/webhook] ${event.event}`, {
                    room: event.room?.name,
                    identity: event.participant?.identity,
                    ts: new Date().toISOString(),
                })
                break
            }

            case 'egress_started': {
                // Persist egressId on the LiveEvent for tracking
                const egressId = event.egressInfo?.egressId
                const roomName = event.room?.name
                if (egressId && roomName) {
                    await prisma.liveEvent.updateMany({
                        where: { roomName },
                        data: { egressId },
                    })
                }
                console.info('[livekit/webhook] egress_started', { egressId, roomName })
                break
            }
            case 'egress_updated': {
                console.info('[livekit/webhook] egress_updated', { egressId: event.egressInfo?.egressId })
                break
            }

            case 'egress_ended': {
                const egressId = event.egressInfo?.egressId
                const rawUrl = (event.egressInfo as { fileResults?: Array<{ downloadUrl?: string }> })
                    ?.fileResults?.[0]?.downloadUrl
                const roomName = event.room?.name

                if (egressId && roomName) {
                    // Prefer public R2 URL over the signed download URL when available.
                    // Use the URL API instead of a regex so query params and trailing
                    // slashes are handled correctly regardless of URL structure.
                    let recordingUrl: string | null = rawUrl ?? null
                    const r2PublicBase = process.env.R2_PUBLIC_URL
                    if (rawUrl && r2PublicBase) {
                        try {
                            const parsed = new URL(rawUrl)
                            const base = new URL(r2PublicBase)
                            parsed.protocol = base.protocol
                            parsed.hostname = base.hostname
                            parsed.port = base.port
                            recordingUrl = parsed.toString()
                        } catch {
                            // Malformed URL — fall back to the raw download URL
                            recordingUrl = rawUrl
                        }
                    }

                    await prisma.liveEvent.updateMany({
                        where: { roomName },
                        data: {
                            recordingUrl: recordingUrl ?? undefined,
                            egressId: null, // clear — recording is done
                        },
                    })
                    console.info('[livekit/webhook] egress_ended', { egressId, roomName, recordingUrl })
                }
                break
            }

            default:
                console.info('[livekit/webhook] unhandled event', event.event)
        }

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('[livekit/webhook] verification failed', error)
        return NextResponse.json({ error: 'Invalid webhook' }, { status: 401 })
    }
}
