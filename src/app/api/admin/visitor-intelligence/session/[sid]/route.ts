import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ sid: string }> }
) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { sid } = await params
    const db = prisma as any

    const pageViews = await db.pageView.findMany({
        where: { sessionId: sid },
        orderBy: { createdAt: 'asc' },
        select: {
            id: true, path: true, device: true, country: true,
            referrer: true, event: true, durationMs: true,
            createdAt: true, userId: true,
        },
    })

    // Resolve user if any page view has userId
    const userId = pageViews.find((p: any) => p.userId)?.userId || null
    const user = userId ? await db.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true, loginMethod: true },
    }) : null

    const totalDuration = pageViews.reduce((sum: number, p: any) => sum + (p.durationMs || 0), 0)

    return NextResponse.json({
        sessionId: sid,
        pageViews: pageViews.map((p: any) => ({
            ...p,
            createdAt: p.createdAt.toISOString(),
        })),
        user,
        summary: {
            totalPages: pageViews.length,
            totalDurationMs: totalDuration,
            startedAt: pageViews[0]?.createdAt?.toISOString() || null,
            endedAt: pageViews[pageViews.length - 1]?.createdAt?.toISOString() || null,
            devices: [...new Set(pageViews.map((p: any) => p.device).filter(Boolean))],
            countries: [...new Set(pageViews.map((p: any) => p.country).filter(Boolean))],
            entryPage: pageViews[0]?.path || null,
            exitPage: pageViews[pageViews.length - 1]?.path || null,
        },
    })
}
