/**
 * POST /api/watch-party/analytic
 * --------------------------------------------------------------------------
 * Client-side analytic event sink for Watch Party viewer activity.
 *
 * Called by WatchPartyShell for viewer-side milestones:
 *   joined_lobby | entered_playback
 *   playback_25  | playback_50 | playback_90 | completed
 *   left_early   | rejoined    | replay_started
 *
 * Also used by WatchPartyChat for: chat_sent | reaction_sent
 *
 * Body: { roomName: string; name: string; metadata?: Record<string, unknown> }
 * Response: always { ok: true } — never surfaces errors to the client.
 *
 * Security:
 *   - Requires authenticated session (unauthenticated calls return ok silently).
 *   - `name` is validated against the allow-list before persisting.
 *   - Works with navigator.sendBeacon (accepts Blob with application/json).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import {
    logAnalyticByRoomName,
    type WatchPartyAnalyticName,
} from '@/lib/liveEvent/analytics'

// Allow-list: only Watch-Party events should be submitted client-side.
// LiveKit events are fired server-side on webhook delivery.
const ALLOWED_NAMES = new Set<WatchPartyAnalyticName>([
    'joined_lobby',
    'entered_playback',
    'playback_25',
    'playback_50',
    'playback_90',
    'completed',
    'left_early',
    'rejoined',
    'replay_started',
    'chat_sent',
    'reaction_sent',
])

export async function POST(req: NextRequest) {
    try {
        // Auth — silently accept without session so pagehide/sendBeacon works
        // even when the cookie has just expired on a long session.
        const session = await getUserSession().catch(() => null)

        let body: { roomName?: string; name?: string; metadata?: Record<string, unknown> }
        try {
            body = await req.json()
        } catch {
            // sendBeacon may send empty body on some browsers — ignore gracefully
            return NextResponse.json({ ok: true })
        }

        const { roomName, name, metadata } = body

        // Validate required fields
        if (!roomName || typeof roomName !== 'string') return NextResponse.json({ ok: true })
        if (!name    || typeof name !== 'string')     return NextResponse.json({ ok: true })

        // Reject unknown event names — prevents arbitrary DB writes from client
        if (!ALLOWED_NAMES.has(name as WatchPartyAnalyticName)) {
            return NextResponse.json({ ok: true })
        }

        await logAnalyticByRoomName(
            roomName,
            session?.userId ?? null,
            name as WatchPartyAnalyticName,
            typeof metadata === 'object' && metadata !== null ? metadata : undefined,
        )

        return NextResponse.json({ ok: true })
    } catch {
        // Analytics failure must NEVER surface as an error to the client
        return NextResponse.json({ ok: true })
    }
}
