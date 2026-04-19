/**
 * POST /api/watch-party/heartbeat
 * --------------------------------------------------------------------------
 * Lightweight presence heartbeat called every 20s by connected viewers.
 *
 * - Refreshes the Redis presence key TTL (35s) for this user in this room.
 * - Returns the current viewer count (SCAN-based, acceptable at v1 scale).
 *
 * Body: { roomName: string }
 * Response: { count: number }
 *
 * Auth: requires authenticated session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { heartbeatPresence, getPresenceCount } from '@/lib/watchParty/pubsub'

export async function POST(req: NextRequest) {
    try {
        const session = await getUserSession()
        if (!session?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json() as { roomName?: string }
        const { roomName } = body

        if (!roomName) {
            return NextResponse.json({ error: 'roomName is required' }, { status: 400 })
        }

        // Refresh presence TTL
        await heartbeatPresence(roomName, session.userId)

        // Return current viewer count
        const count = await getPresenceCount(roomName)

        return NextResponse.json({ count })
    } catch (err) {
        console.error('[watch-party/heartbeat] error:', err)
        return NextResponse.json({ count: 0 }) // Never error the client heartbeat
    }
}
