import { NextResponse } from 'next/server'
import { getSessionAndRefresh } from '@/lib/auth'
import { prisma } from '@/lib/db'

/** GET /api/notifications – fetch the current user's in-app notifications
 *  Query params:
 *    unread  – if "true", return only unread
 *    limit   – max results (default 20, max 50)
 *    cursor  – ISO timestamp; return notifications older than this (for pagination)
 */
export async function GET(req: Request) {
    const session = await getSessionAndRefresh()
    const userId = (session as { userId?: string; id?: string } | null)?.userId
        || (session as { userId?: string; id?: string } | null)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const { searchParams } = new URL(req.url)
        const unreadOnly = searchParams.get('unread') === 'true'
        const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)
        const cursorStr = searchParams.get('cursor')
        const cursorDate = cursorStr ? new Date(cursorStr) : null

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any
        const [notifications, unreadCount] = await Promise.all([
            db.userNotification.findMany({
                where: {
                    userId,
                    ...(unreadOnly ? { read: false } : {}),
                    ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
            }),
            db.userNotification.count({ where: { userId, read: false } }),
        ])

        // nextCursor: createdAt of the oldest item returned (for the next page)
        const nextCursor = notifications.length === limit
            ? notifications[notifications.length - 1].createdAt.toISOString()
            : null

        return NextResponse.json({ notifications, unreadCount, nextCursor })
    } catch (err) {
        console.error('[notifications] GET error:', err)
        return NextResponse.json({ notifications: [], unreadCount: 0, nextCursor: null })
    }
}


/** PATCH /api/notifications – mark all (or specific) notifications as read */
export async function PATCH(req: Request) {
    const session = await getSessionAndRefresh()
    const userId = (session as { userId?: string; id?: string } | null)?.userId
        || (session as { userId?: string; id?: string } | null)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const body = await req.json().catch(() => ({}))
        const { ids } = body as { ids?: string[] }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any

        if (ids && ids.length > 0) {
            await db.userNotification.updateMany({
                where: { id: { in: ids }, userId },
                data: { read: true },
            })
        } else {
            await db.userNotification.updateMany({
                where: { userId, read: false },
                data: { read: true },
            })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[notifications] PATCH error:', err)
        return NextResponse.json({ error: 'Failed to mark notifications' }, { status: 500 })
    }
}

