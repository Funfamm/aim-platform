/**
 * GET /api/watch-party/subscribe/[roomName]
 * --------------------------------------------------------------------------
 * Server-Sent Events endpoint. Streams real-time playback state to viewers.
 *
 * Architecture (Vercel-compatible):
 *   Uses DB polling instead of Redis Pub/Sub. Redis Pub/Sub requires a
 *   persistent TCP connection which Vercel serverless functions cannot hold.
 *   Instead, this route:
 *     1. Reads the current state (Redis hash → DB fallback).
 *     2. Sends an initial `sync` event.
 *     3. Polls for state changes every 2 seconds.
 *     4. Emits a new SSE event when status or playback position changes.
 *     5. When the client disconnects the stream closes cleanly.
 *
 *   Vercel's max serverless duration is 300 seconds. The client (EventSource)
 *   will auto-reconnect, and the initial sync on each reconnect brings the
 *   viewer to the current host position.
 *
 * Auth: requires authenticated session.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Allow up to 270s (buffer before Vercel's 300s kill)
export const maxDuration = 270

import { NextRequest } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
    getPlaybackState,
    heartbeatPresence,
    type PlaybackState,
} from '@/lib/watchParty/pubsub'

const POLL_INTERVAL_MS = 2000  // How often to check for state changes
const PING_INTERVAL_MS = 25000 // Keep-alive ping to prevent proxy timeouts

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ roomName: string }> },
) {
    const { roomName } = await params

    // ── Auth ─────────────────────────────────────────────────────────────────
    const session = await getUserSession()
    if (!session?.userId) {
        return new Response('Unauthorized', { status: 401 })
    }

    // ── Register initial presence ─────────────────────────────────────────────
    await heartbeatPresence(roomName, session.userId).catch(() => {})

    // ── Resolve initial playback state ────────────────────────────────────────
    let initialState = await getPlaybackState(roomName)

    if (!initialState) {
        // Redis is cold — read durable checkpoint from DB
        try {
            const event = await prisma.liveEvent.findUnique({
                where:  { roomName },
                select: { status: true, lastCheckpointSec: true, lobbyEnabled: true },
            })
            if (event) {
                const wpStatus =
                    event.status === 'ended'  ? 'ended'  :
                    event.status === 'live'   ? 'playing' :
                    event.lobbyEnabled        ? 'lobby'   : 'playing'
                initialState = {
                    playing:        false,
                    currentTimeSec: event.lastCheckpointSec ?? 0,
                    status:         wpStatus as PlaybackState['status'],
                    lastUpdatedAt:  new Date().toISOString(),
                }
            }
        } catch (err) {
            console.error('[watch-party/subscribe] DB fallback failed:', err)
        }
    }

    // ── Build SSE stream ──────────────────────────────────────────────────────
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
        async start(controller) {
            let closed = false

            const send = (event: string, payload: Record<string, unknown>) => {
                if (closed) return
                try {
                    controller.enqueue(
                        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
                    )
                } catch {
                    closed = true
                }
            }

            const sendPing = () => {
                if (closed) return
                try {
                    controller.enqueue(encoder.encode(': ping\n\n'))
                } catch {
                    closed = true
                }
            }

            // 1. Send initial sync so client knows current position immediately
            const effectiveStatus = initialState?.status ?? 'lobby'
            send(
                effectiveStatus === 'lobby' ? 'lobby' : 'sync',
                {
                    playing:        initialState?.playing        ?? false,
                    currentTimeSec: initialState?.currentTimeSec ?? 0,
                    status:         effectiveStatus,
                }
            )

            // 2. Track last-sent state so we only emit on actual changes
            let lastStatus    = effectiveStatus
            let lastTimeSec   = initialState?.currentTimeSec ?? 0
            let lastPlaying   = initialState?.playing ?? false
            let lastUpdatedAt = initialState?.lastUpdatedAt ?? ''

            // 3. Poll for state changes
            const pollInterval = setInterval(async () => {
                if (closed) { clearInterval(pollInterval); return }
                try {
                    const state = await getPlaybackState(roomName)
                    if (!state) return

                    // Emit on any meaningful change
                    const statusChanged  = state.status !== lastStatus
                    const playingChanged = state.playing !== lastPlaying
                    const updatedAt      = state.lastUpdatedAt !== lastUpdatedAt

                    if (statusChanged || playingChanged || updatedAt) {
                        lastStatus    = state.status
                        lastTimeSec   = state.currentTimeSec
                        lastPlaying   = state.playing
                        lastUpdatedAt = state.lastUpdatedAt

                        if (state.status === 'ended') {
                            send('ended', { status: 'ended', playing: false, currentTimeSec: state.currentTimeSec })
                        } else if (state.status === 'paused') {
                            send('paused', { status: 'paused', playing: false, currentTimeSec: state.currentTimeSec })
                        } else {
                            // 'playing' or 'lobby' — send sync
                            send(state.status === 'lobby' ? 'lobby' : 'sync', {
                                playing:        state.playing,
                                currentTimeSec: state.currentTimeSec,
                                status:         state.status,
                            })
                        }
                    }
                } catch (err) {
                    console.error('[watch-party/subscribe] poll error:', err)
                }
            }, POLL_INTERVAL_MS)

            // 4. Keep-alive pings
            const pingInterval = setInterval(sendPing, PING_INTERVAL_MS)

            // 5. Cleanup on disconnect
            req.signal.addEventListener('abort', () => {
                closed = true
                clearInterval(pollInterval)
                clearInterval(pingInterval)
                try { controller.close() } catch { /* already closed */ }
            })
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type':     'text/event-stream',
            'Cache-Control':    'no-cache, no-transform',
            'Connection':       'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    })
}
