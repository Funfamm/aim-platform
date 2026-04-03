/**
 * GET /api/notifications/poll
 * ---------------------------------------------------------------------------
 * Long-polling fallback for browsers that don't support WebSocket.
 * Returns all notifications created AFTER the `cursor` timestamp.
 *
 * Query params:
 *   cursor  – ISO timestamp (e.g. 2024-01-01T00:00:00.000Z). Defaults to 30s ago.
 *   limit   – max results (default 20, max 50)
 *
 * The client should:
 *   1. Store the `cursor` from the last response (or now() if none).
 *   2. Poll every 10–15 seconds when WebSocket is unavailable.
 */
import { NextResponse } from 'next/server'
import { getSessionAndRefresh } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
    const session = await getSessionAndRefresh()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (session as any)?.userId || (session as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const cursorStr = searchParams.get('cursor')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)

    // Default: 30 seconds ago (catch any missed events)
    const after = cursorStr ? new Date(cursorStr) : new Date(Date.now() - 30_000)

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any
        const notifications = await db.userNotification.findMany({
            where: {
                userId,
                createdAt: { gt: after },
            },
            orderBy: { createdAt: 'asc' },
            take: limit,
        })

        // Return the cursor for the next poll (latest createdAt or same as input)
        const nextCursor = notifications.length > 0
            ? notifications[notifications.length - 1].createdAt.toISOString()
            : after.toISOString()

        return NextResponse.json({ notifications, nextCursor })
    } catch (err) {
        console.error('[notifications/poll] GET error:', err)
        return NextResponse.json({ notifications: [], nextCursor: new Date().toISOString() })
    }
}
