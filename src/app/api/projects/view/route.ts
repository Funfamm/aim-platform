import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

// Anonymous view deduplication: 1 request per IP per 30 minutes
// Prevents bots / refresh-farmers from inflating trending scores
const anonViewLimiter = rateLimit({ interval: 30 * 60_000, limit: 1 })

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { projectId, source = 'browse', locale = 'en', durationMs } = body

        if (!projectId || typeof projectId !== 'string') {
            return NextResponse.json({ ok: false })
        }

        // Verify project exists (cheap index lookup)
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true },
        })
        if (!project) return NextResponse.json({ ok: false })

        // Try to get authenticated user — gracefully handles anonymous visitors
        let userId: string | undefined
        try {
            const session = await getSession()
            userId = session?.userId ?? undefined
        } catch { /* anonymous */ }

        // Deduplication: one view credit per user per project per 30 minutes
        // Prevents trending manipulation via refreshing
        const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)

        if (userId) {
            const recentView = await prisma.projectView.findFirst({
                where: { projectId, userId, createdAt: { gte: thirtyMinAgo } },
                select: { id: true },
            })
            if (recentView) {
                // Update duration if a more accurate reading came in (page leave event)
                if (durationMs && typeof durationMs === 'number') {
                    await prisma.projectView.update({
                        where: { id: recentView.id },
                        data: { durationMs },
                    })
                }
                return NextResponse.json({ ok: true, counted: false })
            }
        }

        // Anonymous visitor: apply IP rate limit (1 view/IP/30min)
        if (!userId) {
            const blocked = anonViewLimiter.check(req)
            if (blocked) return NextResponse.json({ ok: true, counted: false })
        }

        // Record view + increment cached counter atomically
        await prisma.$transaction([
            prisma.projectView.create({
                data: { projectId, userId, source, locale, durationMs: durationMs ?? null },
            }),
            prisma.project.update({
                where: { id: projectId },
                data: { viewCount: { increment: 1 } },
            }),
        ])

        return NextResponse.json({ ok: true, counted: true })
    } catch (err) {
        console.error('[ProjectView]', err)
        return NextResponse.json({ ok: false })
    }
}
