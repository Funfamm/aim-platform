/**
 * GET /api/watch-party/subscribe/[roomName]
 * --------------------------------------------------------------------------
 * Server-Sent Events endpoint. Streams real-time playback state to viewers.
 *
 * Architecture (Vercel-compatible):
 *   Vercel serverless functions have a hard execution limit. To avoid the
 *   function being force-killed (which logs a Runtime Timeout Error), this
 *   route limits each SSE session to MAX_SESSION_MS (50s) and then gracefully
 *   closes the stream. The browser's EventSource auto-reconnects immediately,
 *   and the initial `sync` event on each reconnect brings the viewer back to the
 *   current host position — no state is lost.
 *
 *   Flow per connection:
 *     1. Read current Redis state (DB fallback if Redis cold).
 *     2. Send initial `sync` event.
 *     3. Poll every 2s for state changes and emit deltas.
 *     4. Send `: ping` every 25s to keep proxies alive.
 *     5. After 50s, send `retry: 1000` + close cleanly.
 *     6. Client reconnects within 1s → repeat from step 1.
 *
 * Auth: requires authenticated session.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60  // 60s hard cap — our session timer closes at 50s

import { NextRequest } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
    getPlaybackState,
    heartbeatPresence,
    type PlaybackState,
} from '@/lib/watchParty/pubsub'

const POLL_INTERVAL_MS  = 2000   // How often to check for state changes
const PING_INTERVAL_MS  = 25000  // Keep-alive ping to prevent proxy timeouts
const MAX_SESSION_MS    = 50000  // Close gracefully before Vercel's 60s limit

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ roomName: string }> },
) {
    const { roomName } = await params

    // ── Auth ──────────────────────────────────────────────────────────────────
    const session = await getUserSession()
    if (!session?.userId) {
        return new Response('Unauthorized', { status: 401 })
    }

    // ── Register initial presence ──────────────────────────────────────────────
    await heartbeatPresence(roomName, session.userId).catch(() => {})

    // ── Resolve initial playback state ─────────────────────────────────────────
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
                    event.status === 'ended'  ? 'ended'   :
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

    // ── Build SSE stream ───────────────────────────────────────────────────────
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

            const sendRaw = (line: string) => {
                if (closed) return
                try {
                    controller.enqueue(encoder.encode(line))
                } catch {
                    closed = true
                }
            }

            const cleanup = () => {
                if (closed) return
                closed = true
                clearInterval(pollInterval)
                clearInterval(pingInterval)
                clearTimeout(sessionTimer)
                try { controller.close() } catch { /* already closed */ }
            }

            // 1. Send initial sync so client knows current position immediately
            const effectiveStatus = initialState?.status ?? 'lobby'
            send(
                effectiveStatus === 'lobby' ? 'lobby' : 'sync',
                {
                    playing:        initialState?.playing        ?? false,
                    currentTimeSec: initialState?.currentTimeSec ?? 0,
                    status:         effectiveStatus,
                    lastUpdatedAt:  initialState?.lastUpdatedAt  ?? new Date().toISOString(),
                }
            )

            // 2. Track last-sent state so we only emit on actual changes
            let lastStatus    = effectiveStatus
            let lastTimeSec   = initialState?.currentTimeSec ?? 0  // eslint-disable-line @typescript-eslint/no-unused-vars
            let lastPlaying   = initialState?.playing ?? false
            let lastUpdatedAt = initialState?.lastUpdatedAt ?? ''

            // 3. Poll for state changes
            const pollInterval = setInterval(async () => {
                if (closed) { clearInterval(pollInterval); return }
                try {
                    const state = await getPlaybackState(roomName)
                    if (!state) return

                    const statusChanged  = state.status !== lastStatus
                    const playingChanged = state.playing !== lastPlaying
                    const updatedAt      = state.lastUpdatedAt !== lastUpdatedAt

                    if (statusChanged || playingChanged || updatedAt) {
                        lastStatus    = state.status
                        lastTimeSec   = state.currentTimeSec
                        lastPlaying   = state.playing
                        lastUpdatedAt = state.lastUpdatedAt

                        if (state.status === 'ended') {
                            send('ended', { status: 'ended', playing: false, currentTimeSec: state.currentTimeSec, lastUpdatedAt: state.lastUpdatedAt })
                        } else if (state.status === 'paused') {
                            send('paused', { status: 'paused', playing: false, currentTimeSec: state.currentTimeSec, lastUpdatedAt: state.lastUpdatedAt })
                        } else {
                            send(state.status === 'lobby' ? 'lobby' : 'sync', {
                                playing:        state.playing,
                                currentTimeSec: state.currentTimeSec,
                                status:         state.status,
                                lastUpdatedAt:  state.lastUpdatedAt,
                            })
                        }
                    }
                } catch (err) {
                    console.error('[watch-party/subscribe] poll error:', err)
                }
            }, POLL_INTERVAL_MS)

            // 4. Keep-alive pings
            const pingInterval = setInterval(() => sendRaw(': ping\n\n'), PING_INTERVAL_MS)

            // 5. Graceful session expiry — close BEFORE Vercel's hard timeout.
            //    EventSource will reconnect automatically within `retry` ms.
            //    On reconnect, the server sends a fresh sync with current state.
            const sessionTimer = setTimeout(() => {
                if (!closed) {
                    // Tell the browser to reconnect in 1 second
                    sendRaw('retry: 1000\n\n')
                    cleanup()
                }
            }, MAX_SESSION_MS)

            // 6. Cleanup on client disconnect
            req.signal.addEventListener('abort', cleanup)
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type':      'text/event-stream',
            'Cache-Control':     'no-cache, no-transform',
            'Connection':        'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    })
}
