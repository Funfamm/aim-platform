import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'

// GET — check if project is in watchlist, or get full watchlist
export async function GET(req: Request) {
    const session = await getUserSession()
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')

    if (projectId) {
        // Check if specific project is in watchlist
        const entry = await prisma.watchlist.findUnique({
            where: { userId_projectId: { userId: session.userId, projectId } },
        })
        return NextResponse.json({ saved: !!entry })
    }

    // Get full watchlist
    const watchlist = await prisma.watchlist.findMany({
        where: { userId: session.userId },
        include: {
            project: {
                select: {
                    id: true, title: true, slug: true, coverImage: true,
                    genre: true, status: true, year: true, projectType: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(watchlist.map(w => ({
        watchlistId: w.id,
        savedAt: w.createdAt,
        ...w.project,
    })))
}

// POST — add to watchlist
export async function POST(req: Request) {
    const session = await getUserSession()
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { projectId } = await req.json()
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

    try {
        await prisma.watchlist.create({
            data: { userId: session.userId, projectId },
        })
        return NextResponse.json({ saved: true })
    } catch {
        // Already exists (unique constraint)
        return NextResponse.json({ saved: true })
    }
}

// DELETE — remove from watchlist
export async function DELETE(req: Request) {
    const session = await getUserSession()
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

    await prisma.watchlist.deleteMany({
        where: { userId: session.userId, projectId },
    })

    return NextResponse.json({ saved: false })
}
