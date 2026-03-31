import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

/** GET /api/notifications – fetch the current user's in-app notifications */
export async function GET(req: Request) {
    const session = await getSession()
    if (!session?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.id

    const { searchParams } = new URL(req.url)
    const unreadOnly = searchParams.get('unread') === 'true'
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    const notifications = await db.userNotification.findMany({
        where: {
            userId,
            ...(unreadOnly ? { read: false } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
    })

    const unreadCount = await db.userNotification.count({
        where: { userId, read: false },
    })

    return NextResponse.json({ notifications, unreadCount })
}

/** PATCH /api/notifications – mark all (or specific) notifications as read */
export async function PATCH(req: Request) {
    const session = await getSession()
    if (!session?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.id

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
}
