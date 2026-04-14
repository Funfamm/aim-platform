import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

/**
 * GET /api/watch-history?projectId=xxx
 * Returns the user's watch progress (0–1) for a specific project.
 * Used by the hover preview card to show the progress bar.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
        return NextResponse.json({ progress: null })
    }

    // Must be authenticated — anonymous users have no history
    let userId: string | undefined
    try {
        const session = await getSession()
        userId = session?.userId ?? undefined
    } catch { /* not logged in */ }

    if (!userId) {
        return NextResponse.json({ progress: null })
    }

    const entry = await prisma.watchHistory.findFirst({
        where: { userId, projectId },
        select: { progress: true, watchedAt: true },
        orderBy: { watchedAt: 'desc' }, // most recent session
    })

    return NextResponse.json({
        progress: entry?.progress ?? null,
    })
}

/**
 * POST /api/watch-history
 * Upserts watch progress for the authenticated user.
 * Called on player timeupdate events (debounced to every 10s).
 */
export async function POST(req: Request) {
    let userId: string | undefined
    try {
        const session = await getSession()
        userId = session?.userId ?? undefined
    } catch { /* not logged in */ }

    if (!userId) {
        return NextResponse.json({ ok: false }, { status: 401 })
    }

    const body = await req.json()
    const { projectId, progress } = body

    if (!projectId || typeof progress !== 'number' || progress < 0 || progress > 1) {
        return NextResponse.json({ ok: false }, { status: 400 })
    }

    const existing = await prisma.watchHistory.findFirst({
        where: { userId, projectId },
        select: { id: true },
        orderBy: { watchedAt: 'desc' },
    })

    if (existing) {
        await prisma.watchHistory.update({
            where: { id: existing.id },
            data: { progress, watchedAt: new Date() },
        })
    } else {
        await prisma.watchHistory.create({
            data: { userId, projectId, progress },
        })
    }

    return NextResponse.json({ ok: true })
}
