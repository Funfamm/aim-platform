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

    const history = await prisma.watchHistory.findMany({
        where: { userId: session.userId },
        orderBy: { watchedAt: 'desc' },
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
                    duration: true,
                },
            },
        },
    })

    const hasMore = history.length > limit
    const items = hasMore ? history.slice(0, limit) : history
    const nextCursor = hasMore ? items[items.length - 1].id : null

    return NextResponse.json({
        history: items,
        nextCursor,
        hasMore,
    })
}

export async function POST(req: Request) {
    const session = await getUserSession()
    if (!session?.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId, progress } = await req.json()
    if (!projectId) {
        return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }

    const entry = await prisma.watchHistory.create({
        data: {
            userId: session.userId,
            projectId,
            progress: progress || 0,
        },
    })

    return NextResponse.json(entry)
}
