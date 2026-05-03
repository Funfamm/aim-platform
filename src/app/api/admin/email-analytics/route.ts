import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { computeHealthScore } from '@/lib/suppression'

/**
 * GET /api/admin/email-analytics
 * Returns comprehensive email delivery analytics.
 *
 * Query params:
 *   - period: 'daily' | 'weekly' | 'monthly' (default: 'daily')
 *   - tz: timezone offset in minutes (for chart date alignment)
 *   - logPage: page for email log table (default: 1)
 *   - logLimit: per-page for email log (default: 30, max 100)
 *   - logFilter: filter logs by type (authentication, application, notification, subscribe, general)
 *   - logStatus: filter logs by status (success, failed, all) — default: 'all'
 *   - logSearch: search logs by recipient email
 *   - logTransport: filter by transport (graph, smtp, acs, unknown)
 *   - logBounce: filter by bounce category (hard_bounce, soft_bounce, complaint, throttle)
 */
export async function GET(request: Request) {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(request.url)
    const period = url.searchParams.get('period') || 'daily'
    const tzOffsetMin = parseInt(url.searchParams.get('tz') || '0', 10) || 0

    // Log pagination & filters
    const logPage = Math.max(1, parseInt(url.searchParams.get('logPage') || '1', 10))
    const logLimit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('logLimit') || '30', 10)))
    const logFilter = url.searchParams.get('logFilter') || undefined
    const logStatus = url.searchParams.get('logStatus') || 'all'
    const logSearch = url.searchParams.get('logSearch') || undefined
    const logTransport = url.searchParams.get('logTransport') || undefined
    const logBounce = url.searchParams.get('logBounce') || undefined

    const now = new Date()

    // ── Period-based date ranges ──────────────────────────────────────────
    // For daily: stats cover today only (start of day in user's tz)
    // For weekly/monthly: stats cover 30d / 90d as before
    let periodStart: Date
    let periodDays: number
    if (period === 'daily') {
        periodDays = 1
        // Compute start-of-today in the user's local timezone
        const localNow = new Date(now.getTime() - tzOffsetMin * 60 * 1000)
        const startOfLocalDay = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate()))
        periodStart = new Date(startOfLocalDay.getTime() + tzOffsetMin * 60 * 1000)
    } else {
        periodDays = period === 'monthly' ? 90 : 30
        periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000)
    }
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // ── Core Stats (all time + period) ────────────────────────────────────
    const [
        totalSent, totalSuccess, totalFailed, totalOpened,
        periodSent, periodSuccess, periodFailed, periodOpened,
    ] = await Promise.all([
        prisma.emailLog.count(),
        prisma.emailLog.count({ where: { success: true } }),
        prisma.emailLog.count({ where: { success: false } }),
        prisma.emailLog.count({ where: { openedAt: { not: null } } }),
        prisma.emailLog.count({ where: { sentAt: { gte: periodStart } } }),
        prisma.emailLog.count({ where: { sentAt: { gte: periodStart }, success: true } }),
        prisma.emailLog.count({ where: { sentAt: { gte: periodStart }, success: false } }),
        prisma.emailLog.count({ where: { sentAt: { gte: periodStart }, openedAt: { not: null } } }),
    ])

    // ── Bounce breakdown (period) ─────────────────────────────────────────
    const bounceBreakdown = await prisma.emailLog.groupBy({
        by: ['bounceCategory'],
        where: { sentAt: { gte: periodStart }, success: false, bounceCategory: { not: null } },
        _count: true,
    })

    const bounceStats: Record<string, number> = {}
    for (const b of bounceBreakdown) {
        if (b.bounceCategory) bounceStats[b.bounceCategory] = b._count
    }

    // ── Type breakdown (period) ───────────────────────────────────────────
    const typeBreakdown = await prisma.emailLog.groupBy({
        by: ['type'],
        where: { sentAt: { gte: periodStart } },
        _count: true,
        orderBy: { _count: { type: 'desc' } },
    })

    // ── Transport breakdown (period) ──────────────────────────────────────
    const transportBreakdown = await prisma.emailLog.groupBy({
        by: ['transport'],
        where: { sentAt: { gte: periodStart } },
        _count: true,
        orderBy: { _count: { transport: 'desc' } },
    })

    // ── Daily/Weekly/Monthly volume chart ─────────────────────────────────
    let chartFormat: string
    let chartDays: number
    if (period === 'monthly') {
        chartFormat = 'YYYY-MM'  // group by month
        chartDays = 90
    } else if (period === 'weekly') {
        chartFormat = 'IYYY-IW'  // group by ISO week
        chartDays = 30
    } else {
        chartFormat = 'YYYY-MM-DD'
        chartDays = 7
    }

    const chartStart = new Date(now.getTime() - chartDays * 24 * 60 * 60 * 1000 - tzOffsetMin * 60 * 1000)

    const dailyRaw: { period: string; total: bigint; failed: bigint; opened: bigint }[] = await prisma.$queryRawUnsafe(`
        SELECT
            TO_CHAR("sentAt" + INTERVAL '1 minute' * $2, '${chartFormat}') as period,
            COUNT(*)::bigint as total,
            COUNT(*) FILTER (WHERE success = false)::bigint as failed,
            COUNT(*) FILTER (WHERE "openedAt" IS NOT NULL)::bigint as opened
        FROM "EmailLog"
        WHERE "sentAt" >= $1
        GROUP BY period
        ORDER BY period ASC
    `, chartStart, -tzOffsetMin)

    const chartVolume = dailyRaw.map(r => ({
        period: r.period,
        sent: Number(r.total),
        failed: Number(r.failed),
        opened: Number(r.opened),
    }))

    // ── Health Score ──────────────────────────────────────────────────────
    const healthScore = await computeHealthScore()

    // ── Suppression stats ────────────────────────────────────────────────
    const [suppressedTotal, suppressedRecent] = await Promise.all([
        prisma.emailSuppression.count({ where: { removedAt: null } }),
        prisma.emailSuppression.count({ where: { removedAt: null, createdAt: { gte: thirtyDaysAgo } } }),
    ])

    // ── Deep Email Log (paginated, filtered, searchable) ─────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logWhere: any = {}

    if (logFilter) logWhere.type = logFilter
    if (logStatus === 'success') logWhere.success = true
    else if (logStatus === 'failed') logWhere.success = false
    if (logSearch) logWhere.to = { contains: logSearch.toLowerCase(), mode: 'insensitive' }
    if (logTransport) logWhere.transport = logTransport
    if (logBounce) logWhere.bounceCategory = logBounce

    const [logRecords, logTotal] = await Promise.all([
        prisma.emailLog.findMany({
            where: logWhere,
            orderBy: { sentAt: 'desc' },
            skip: (logPage - 1) * logLimit,
            take: logLimit,
            select: {
                id: true,
                to: true,
                subject: true,
                type: true,
                transport: true,
                success: true,
                error: true,
                bounceCategory: true,
                sentAt: true,
                openedAt: true,
            },
        }),
        prisma.emailLog.count({ where: logWhere }),
    ])

    // ── Top failing recipients (period) ──────────────────────────────────
    const topFailingRaw: { to: string; fail_count: bigint }[] = await prisma.$queryRawUnsafe(`
        SELECT "to", COUNT(*)::bigint as fail_count
        FROM "EmailLog"
        WHERE success = false AND "sentAt" >= $1
        GROUP BY "to"
        ORDER BY fail_count DESC
        LIMIT 10
    `, periodStart)

    const topFailing = topFailingRaw.map(r => ({
        email: r.to,
        failures: Number(r.fail_count),
    }))

    return NextResponse.json({
        period,
        allTime: {
            totalSent,
            totalSuccess,
            totalFailed,
            totalOpened,
            successRate: totalSent > 0 ? Math.round((totalSuccess / totalSent) * 10000) / 100 : 0,
            openRate: totalSuccess > 0 ? Math.round((totalOpened / totalSuccess) * 10000) / 100 : 0,
        },
        periodStats: {
            days: periodDays,
            sent: periodSent,
            success: periodSuccess,
            failed: periodFailed,
            opened: periodOpened,
            successRate: periodSent > 0 ? Math.round((periodSuccess / periodSent) * 10000) / 100 : 0,
            openRate: periodSuccess > 0 ? Math.round((periodOpened / periodSuccess) * 10000) / 100 : 0,
        },
        bounceStats,
        typeBreakdown: typeBreakdown.map(t => ({ type: t.type, count: t._count })),
        transportBreakdown: transportBreakdown.map(t => ({ transport: t.transport, count: t._count })),
        chartVolume,
        healthScore,
        suppression: {
            totalActive: suppressedTotal,
            addedLast30Days: suppressedRecent,
        },
        topFailing,
        // Deep email log
        emailLog: {
            records: logRecords,
            total: logTotal,
            page: logPage,
            limit: logLimit,
            totalPages: Math.ceil(logTotal / logLimit),
        },
    })
}
