import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
    const session = await getUserSession()
    if (!session?.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    const watchlist = await prisma.watchlist.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
            project: {
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    coverImage: true,
                    genre: true,
                    status: true,
                    tagline: true,
                    translations: true,
                },
            },
        },
    })

    const hasMore = watchlist.length > limit
    const items = hasMore ? watchlist.slice(0, limit) : watchlist
    const nextCursor = hasMore ? items[items.length - 1].id : null

    return NextResponse.json({
        watchlist: items,
        nextCursor,
        hasMore,
    })
}

// DELETE a single watchlist item by projectId
export async function DELETE(request: NextRequest) {
    const session = await getUserSession()
    if (!session?.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    try {
        const { projectId } = await request.json()
        if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })
        await prisma.watchlist.deleteMany({
            where: { userId: session.userId, projectId },
        })
        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ error: 'Failed to remove' }, { status: 500 })
    }
}

// POST /api/dashboard/watchlist  with { bulk: true, projectIds: [] } — bulk remove
export async function POST(request: NextRequest) {
    const session = await getUserSession()
    if (!session?.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    try {
        const body = await request.json()
        if (!body.bulk || !Array.isArray(body.projectIds) || body.projectIds.length === 0) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
        }
        const ids: string[] = body.projectIds.slice(0, 100) // safety cap
        await prisma.watchlist.deleteMany({
            where: { userId: session.userId, projectId: { in: ids } },
        })
        return NextResponse.json({ success: true, removed: ids.length })
    } catch {
        return NextResponse.json({ error: 'Failed to remove items' }, { status: 500 })
    }
}
