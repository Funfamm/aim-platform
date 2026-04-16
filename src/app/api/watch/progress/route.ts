import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'

/**
 * GET /api/watch/progress?projectId=xxx[&episodeId=yyy]
 *
 * Returns the last saved watch position for the authenticated user.
 *
 * Response:
 *   { completePct: number | null, episodeId: string | null }
 *
 * completePct is 0.0–1.0. Returns null when no history found.
 * Only records with completePct < 0.97 are returned — if the user
 * finished the film (≥97%) we treat it as "watched" and don't resume.
 */
export async function GET(req: NextRequest) {
    const session = await getUserSession()
    if (!session?.userId) {
        return NextResponse.json({ completePct: null, episodeId: null })
    }

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) {
        return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    try {
        const record = await prisma.watchHistory.findFirst({
            where: { userId: session.userId, projectId },
            orderBy: { watchedAt: 'desc' },
            select: { completePct: true },
        })

        // Don't resume if user watched ≥97% (treat as completed)
        const pct = record?.completePct ?? null
        const resumeable = pct !== null && pct < 0.97 && pct > 0.01

        return NextResponse.json({
            completePct: resumeable ? pct : null,
        })
    } catch (err) {
        console.error('[watch/progress] Error:', err)
        return NextResponse.json({ completePct: null, episodeId: null })
    }
}
