import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/admin/email-analytics
 * Returns email delivery analytics aggregated from EmailLog.
 */
export async function GET() {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // All-time stats
    const [totalSent, totalSuccess, totalFailed, totalOpened] = await Promise.all([
        prisma.emailLog.count(),
        prisma.emailLog.count({ where: { success: true } }),
        prisma.emailLog.count({ where: { success: false } }),
        prisma.emailLog.count({ where: { openedAt: { not: null } } }),
    ])

    // 30-day stats
    const [sent30d, success30d, failed30d, opened30d] = await Promise.all([
        prisma.emailLog.count({ where: { sentAt: { gte: thirtyDaysAgo } } }),
        prisma.emailLog.count({ where: { sentAt: { gte: thirtyDaysAgo }, success: true } }),
        prisma.emailLog.count({ where: { sentAt: { gte: thirtyDaysAgo }, success: false } }),
        prisma.emailLog.count({ where: { sentAt: { gte: thirtyDaysAgo }, openedAt: { not: null } } }),
    ])

    // Breakdown by type (30 days)
    const typeBreakdown = await prisma.emailLog.groupBy({
        by: ['type'],
        where: { sentAt: { gte: thirtyDaysAgo } },
        _count: true,
        orderBy: { _count: { type: 'desc' } },
    })

    // Daily send volume (last 7 days) — aggregated at DB level for performance
    const dailyRaw: { day: string; total: bigint; failed: bigint }[] = await prisma.$queryRaw`
        SELECT
            TO_CHAR("sentAt", 'YYYY-MM-DD') as day,
            COUNT(*)::bigint as total,
            COUNT(*) FILTER (WHERE success = false)::bigint as failed
        FROM "EmailLog"
        WHERE "sentAt" >= ${sevenDaysAgo}
        GROUP BY day
        ORDER BY day ASC
    `
    const dailyVolume = dailyRaw.map(d => ({
        date: d.day,
        sent: Number(d.total),
        failed: Number(d.failed),
    }))

    // Recent failures (last 20)
    const recentFailures = await prisma.emailLog.findMany({
        where: { success: false },
        orderBy: { sentAt: 'desc' },
        take: 20,
        select: {
            id: true,
            to: true,
            subject: true,
            type: true,
            error: true,
            sentAt: true,
        },
    })

    return NextResponse.json({
        allTime: {
            totalSent,
            totalSuccess,
            totalFailed,
            totalOpened,
            successRate: totalSent > 0 ? Math.round((totalSuccess / totalSent) * 10000) / 100 : 0,
            openRate: totalSuccess > 0 ? Math.round((totalOpened / totalSuccess) * 10000) / 100 : 0,
        },
        last30Days: {
            sent: sent30d,
            success: success30d,
            failed: failed30d,
            opened: opened30d,
            successRate: sent30d > 0 ? Math.round((success30d / sent30d) * 10000) / 100 : 0,
            openRate: success30d > 0 ? Math.round((opened30d / success30d) * 10000) / 100 : 0,
        },
        typeBreakdown: typeBreakdown.map(t => ({
            type: t.type,
            count: t._count,
        })),
        dailyVolume,
        recentFailures,
    })
}
