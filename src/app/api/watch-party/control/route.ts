/**
 * POST /api/watch-party/control
 * --------------------------------------------------------------------------
 * Host/admin playback control endpoint.
 *
 * Accepts: { roomName, action, currentTimeSec? }
 * Actions: play | pause | seek | end | lobby
 *
 * For each action:
 *  1. Validates caller is host or admin.
 *  2. Updates Redis state hash (immediate — all subscribers see it on next read).
 *  3. Publishes event to Pub/Sub channel (viewers receive it within ~1s).
 *  4. Writes durable DB milestone when warranted:
 *     - play → playbackStartedAt, status live
 *     - end  → endedAt, status ended, lastCheckpointSec
 *     - lobby → status scheduled, reset timestamps
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
    getPlaybackState,
    setPlaybackState,
    publishPlaybackEvent,
    type PlaybackState,
    type WatchPartyStatus,
} from '@/lib/watchParty/pubsub'

type Action = 'play' | 'pause' | 'seek' | 'end' | 'lobby'

export async function POST(req: NextRequest) {
    try {
        const session = await getUserSession()
        if (!session?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json() as {
            roomName:       string
            action:         Action
            currentTimeSec?: number
        }
        const { roomName, action, currentTimeSec = 0 } = body

        if (!roomName || !action) {
            return NextResponse.json({ error: 'roomName and action are required' }, { status: 400 })
        }
        if (!['play', 'pause', 'seek', 'end', 'lobby'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
        }

        // ── Authorization ─────────────────────────────────────────────────────
        const isAdmin = ['admin', 'superadmin'].includes(session.role ?? '')
        if (!isAdmin) {
            // Non-admins must be the designated host for this room
            const event = await prisma.liveEvent.findUnique({
                where:  { roomName },
                select: { hostUserId: true, eventType: true },
            })
            if (!event) {
                return NextResponse.json({ error: 'Event not found' }, { status: 404 })
            }
            if (event.eventType !== 'watch_party') {
                return NextResponse.json({ error: 'Not a watch party' }, { status: 400 })
            }
            if (event.hostUserId !== session.userId) {
                return NextResponse.json({ error: 'Only the host may control playback' }, { status: 403 })
            }
        }

        // ── Compute new state ─────────────────────────────────────────────────
        const now = new Date().toISOString()
        const prev = await getPlaybackState(roomName)

        let newStatus: WatchPartyStatus = prev?.status ?? 'lobby'
        // When Redis has no state (cold start / TTL expired), assume not playing.
        // For 'seek', we trust the prev state; if there's no prev at all we return
        // early — there's nothing to checkpoint against and writing playing=false
        // would incorrectly pause all viewers.
        if (action === 'seek' && !prev) {
            return NextResponse.json({ ok: true, skipped: true })
        }
        let playing = prev?.playing ?? false

        switch (action) {
            case 'play':
                playing   = true
                newStatus = 'playing'
                break
            case 'pause':
                playing   = false
                newStatus = 'paused'
                break
            case 'seek':
                // Status unchanged — just update time
                break
            case 'end':
                playing   = false
                newStatus = 'ended'
                break
            case 'lobby':
                playing   = false
                newStatus = 'lobby'
                break
        }

        const newState: PlaybackState = {
            playing,
            currentTimeSec: action === 'lobby' ? 0 : currentTimeSec,
            status:        newStatus,
            lastUpdatedAt: now,
        }

        // ── 1. Update Redis state hash ─────────────────────────────────────────
        await setPlaybackState(roomName, newState)

        // ── 2. Publish to Pub/Sub channel ─────────────────────────────────────
        // Background seek checkpoints (from hostSyncTimer) ONLY update the Redis
        // time snapshot — they do NOT broadcast a sync event to clients.
        // Broadcasting on every seek was triggering handleSync on all viewers AND
        // the host ~every 5 s, creating a race where a stale/null prev could
        // flip playing=false and pause everyone.
        // Interactive actions (play, pause, end, lobby) still broadcast immediately.
        if (action !== 'seek') {
            await publishPlaybackEvent(roomName, {
                event:   action === 'end' ? 'ended' : action === 'lobby' ? 'lobby' : action === 'pause' ? 'paused' : 'sync',
                payload: {
                    playing,
                    currentTimeSec: newState.currentTimeSec,
                    status: newStatus,
                },
            })
        }

        // ── 3. Write durable DB milestones ────────────────────────────────────
        try {
            if (action === 'play') {
                await prisma.liveEvent.update({
                    where: { roomName },
                    data: {
                        status:           'live',
                        startedAt:        { set: new Date() },  // only sets if null
                        playbackStartedAt: new Date(),
                        lastCheckpointSec: currentTimeSec,
                    },
                })
            } else if (action === 'end') {
                await prisma.liveEvent.update({
                    where: { roomName },
                    data: {
                        status:           'ended',
                        endedAt:          new Date(),
                        lastCheckpointSec: currentTimeSec,
                    },
                })
            } else if (action === 'lobby') {
                await prisma.liveEvent.update({
                    where: { roomName },
                    data: {
                        status:           'scheduled',
                        startedAt:        null,
                        playbackStartedAt: null,
                        lastCheckpointSec: 0,
                    },
                })
            } else if (action === 'seek') {
                // Only checkpoint large jumps (> 10 min) to avoid noisy DB writes
                const prevTime = prev?.currentTimeSec ?? 0
                if (Math.abs(currentTimeSec - prevTime) > 600) {
                    await prisma.liveEvent.update({
                        where: { roomName },
                        data:  { lastCheckpointSec: currentTimeSec },
                    })
                }
            }
        } catch (dbErr) {
            console.error('[watch-party/control] DB milestone write failed:', dbErr)
        }

        return NextResponse.json({ ok: true, state: newState })
    } catch (err) {
        console.error('[watch-party/control] error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
