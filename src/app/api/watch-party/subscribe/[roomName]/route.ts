/**
 * GET /api/watch-party/subscribe/[roomName]
 * --------------------------------------------------------------------------
 * Server-Sent Events endpoint. Streams real-time playback events to viewers.
 *
 * On connect:
 *  1. Reads current playback state from Redis hash (one GET).
 *  2. Falls back to DB checkpoint if Redis key is cold (after restart).
 *  3. Sends initial `sync` event so client knows where to seek.
 *  4. Subscribes to Redis Pub/Sub channel — forwards all messages to SSE.
 *  5. On client disconnect: unsubscribes cleanly.
 *
 * Reconnect behavior:
 *  - When the SSE stream is interrupted (Vercel function timeout or network
 *    hiccup), EventSource reconnects automatically.
 *  - The initial `sync` on step 3 immediately brings client to current host
 *    position. No missed-message replay needed.
 *
 * Auth: requires authenticated session.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
    getPlaybackState,
    heartbeatPresence,
    subscribeToRoom,
    type WatchPartyEvent,
} from '@/lib/watchParty/pubsub'

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
                    status:         wpStatus as 'lobby' | 'playing' | 'paused' | 'ended',
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
            const send = (event: WatchPartyEvent) => {
                try {
                    const line = `event: ${event.event}\ndata: ${JSON.stringify(event.payload)}\n\n`
                    controller.enqueue(encoder.encode(line))
                } catch {
                    // Stream closed — ignore
                }
            }

            // 1. Send initial sync
            send({
                event: initialState?.status === 'lobby' ? 'lobby' : 'sync',
                payload: {
                    playing:        initialState?.playing        ?? false,
                    currentTimeSec: initialState?.currentTimeSec ?? 0,
                    status:         initialState?.status          ?? 'lobby',
                },
            })

            // 2. Subscribe to Redis channel — forward all messages
            const cleanup = await subscribeToRoom(roomName, send)

            // 3. Keep alive ping every 25s (prevents proxy timeouts)
            const pingInterval = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(': ping\n\n'))
                } catch {
                    clearInterval(pingInterval)
                }
            }, 25_000)

            // 4. Cleanup when client disconnects
            req.signal.addEventListener('abort', async () => {
                clearInterval(pingInterval)
                if (cleanup) await cleanup()
                try { controller.close() } catch { /* already closed */ }
            })
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type':  'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection':    'keep-alive',
            'X-Accel-Buffering': 'no', // disable nginx/Vercel edge buffering
        },
    })
}
