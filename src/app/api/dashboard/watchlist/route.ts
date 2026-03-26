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
