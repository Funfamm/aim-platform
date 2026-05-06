import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

// ── Configurable retention (admin sets via DB settings, default 90 days) ──
const RETENTION_DAYS = 90

export async function GET(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { searchParams } = new URL(req.url)
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '30'))
    const db = prisma as any

    const now = new Date()
    const fiveMin  = new Date(now.getTime() - 5  * 60 * 1000)
    const oneHour  = new Date(now.getTime() - 60 * 60 * 1000)
    const today    = new Date(now); today.setHours(0, 0, 0, 0)
    const week     = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
    const month    = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // ── Parallel queries ──
    const [
        rawFeed,
        onlineNowRows,
        loggedInNowRows,
        countryBreakdown,
        topPagesWithDuration,
        loginEvents,
        funnelVisit,
        funnelCasting,
        funnelApplyStart,
        funnelApplySubmit,
        funnelConverted,
        loginMethodBreakdown,
        hourlyRaw,
        retentionCount,
    ] = await Promise.all([
        // Enriched live feed — last N page views
        db.pageView.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true, path: true, device: true, country: true,
                sessionId: true, referrer: true, event: true,
                durationMs: true, createdAt: true, userId: true,
            },
        }),
        // Online now: any pageview in last 5 min (distinct sessions)
        db.pageView.findMany({
            where: { createdAt: { gte: fiveMin } },
            distinct: ['sessionId'],
            select: { sessionId: true, userId: true },
        }),
        // Logged-in now: subset with userId
        db.pageView.findMany({
            where: { createdAt: { gte: fiveMin }, userId: { not: null } },
            distinct: ['userId'],
            select: { userId: true },
        }),
        // Country breakdown (last 30d)
        db.pageView.groupBy({
            by: ['country'],
            where: { createdAt: { gte: month }, country: { not: null } },
            _count: { country: true },
            orderBy: { _count: { country: 'desc' } },
            take: 15,
        }),
        // Top pages with avg duration (last 7d)
        db.pageView.groupBy({
            by: ['path'],
            where: { createdAt: { gte: week } },
            _count: { path: true },
            _avg: { durationMs: true },
            orderBy: { _count: { path: 'desc' } },
            take: 10,
        }),
        // Recent login events with user info
        db.loginEvent.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: { id: true, userId: true, method: true, ip: true, country: true, createdAt: true },
        }).catch(() => []),
        // Funnel: unique sessions that visited any page (last 30d)
        db.pageView.findMany({ where: { createdAt: { gte: month } }, distinct: ['sessionId'], select: { sessionId: true } }),
        // Funnel: sessions that hit /casting
        db.pageView.findMany({ where: { createdAt: { gte: month }, path: { startsWith: '/casting' } }, distinct: ['sessionId'], select: { sessionId: true } }),
        // Funnel: apply_start events
        db.pageView.findMany({ where: { createdAt: { gte: month }, event: 'apply_start' }, distinct: ['sessionId'], select: { sessionId: true } }),
        // Funnel: apply_submit events  
        db.pageView.findMany({ where: { createdAt: { gte: month }, event: 'apply_submit' }, distinct: ['sessionId'], select: { sessionId: true } }),
        // Funnel: converted (has account)
        db.user.count({ where: { createdAt: { gte: month } } }),
        // Auth method distribution
        db.loginEvent.groupBy({
            by: ['method'],
            _count: { method: true },
            where: { createdAt: { gte: month } },
        }).catch(() => []),
        // Hourly activity today
        db.pageView.findMany({
            where: { createdAt: { gte: today } },
            select: { createdAt: true },
        }),
        // Retention: rows older than threshold
        db.pageView.count({ where: { createdAt: { lt: new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000) } } }),
    ])

    // Resolve user identities for the live feed
    const userIds = [...new Set(rawFeed.filter((r: any) => r.userId).map((r: any) => r.userId as string))]
    const users = userIds.length > 0
        ? await db.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true, role: true, loginMethod: true, avatar: true },
        })
        : []
    const userMap = new Map(users.map((u: any) => [u.id, u]))

    // Resolve user identities for login events
    const loginUserIds = [...new Set(loginEvents.filter((e: any) => e.userId).map((e: any) => e.userId as string))]
    const loginUsers = loginUserIds.length > 0
        ? await db.user.findMany({
            where: { id: { in: loginUserIds } },
            select: { id: true, name: true, email: true, role: true },
        })
        : []
    const loginUserMap = new Map(loginUsers.map((u: any) => [u.id, u]))

    // Enrich live feed
    const feed = rawFeed.map((row: any) => {
        const user = row.userId ? (userMap.get(row.userId) as any) || null : null
        return {
            id: row.id,
            path: row.path,
            device: row.device,
            country: row.country,
            sessionId: row.sessionId,
            referrer: row.referrer,
            event: row.event,
            durationMs: row.durationMs,
            createdAt: row.createdAt.toISOString(),
            identity: user ? {
                name: user.name,
                email: user.email,
                role: user.role,
                loginMethod: user.loginMethod,
                avatar: user.avatar,
                initials: user.name?.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase() || '?',
            } : null,
        }
    })

    // Hourly heatmap
    const hourlyViews = new Array(24).fill(0)
    for (const pv of hourlyRaw) {
        hourlyViews[new Date(pv.createdAt).getHours()]++
    }

    // Geo breakdown
    const geo = countryBreakdown.map((g: any) => ({
        country: g.country,
        count: g._count.country,
    }))

    // Top pages
    const topPages = topPagesWithDuration.map((p: any) => ({
        path: p.path,
        views: p._count.path,
        avgDurationMs: p._avg.durationMs ? Math.round(p._avg.durationMs) : null,
    }))

    // Auth method chart
    const authMethods = loginMethodBreakdown.map((m: any) => ({
        method: m.method,
        count: m._count.method,
    }))

    // Login event feed enriched
    const recentLogins = loginEvents.map((e: any) => {
        const u = loginUserMap.get(e.userId) as any
        return {
            id: e.id,
            method: e.method,
            country: e.country,
            createdAt: e.createdAt.toISOString(),
            user: u ? { name: u.name, email: u.email, role: u.role } : null,
        }
    })

    // Funnel
    const funnel = [
        { step: 'Any Visit',      count: funnelVisit.length,       pct: 100 },
        { step: 'Casting Page',   count: funnelCasting.length,     pct: funnelVisit.length > 0 ? Math.round((funnelCasting.length / funnelVisit.length) * 100) : 0 },
        { step: 'Apply Started',  count: funnelApplyStart.length,  pct: funnelVisit.length > 0 ? Math.round((funnelApplyStart.length / funnelVisit.length) * 100) : 0 },
        { step: 'Apply Submit',   count: funnelApplySubmit.length, pct: funnelVisit.length > 0 ? Math.round((funnelApplySubmit.length / funnelVisit.length) * 100) : 0 },
        { step: 'Converted',      count: funnelConverted,          pct: funnelVisit.length > 0 ? Math.round((funnelConverted / funnelVisit.length) * 100) : 0 },
    ]

    return NextResponse.json({
        feed,
        realTime: {
            onlineNow: onlineNowRows.length,
            loggedInNow: loggedInNowRows.length,
            guestsNow: onlineNowRows.length - loggedInNowRows.length,
        },
        geo,
        topPages,
        authMethods,
        recentLogins,
        funnel,
        hourlyViews,
        retentionWarning: retentionCount > 0 ? retentionCount : 0,
        retention: { days: RETENTION_DAYS },
    })
}

// GDPR: delete all analytics data for a sessionId or userId
export async function DELETE(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { sessionId, userId } = await req.json()
    if (!sessionId && !userId) return NextResponse.json({ error: 'sessionId or userId required' }, { status: 400 })

    const db = prisma as any
    const where: any = {}
    if (sessionId) where.sessionId = sessionId
    if (userId) where.userId = userId

    const deleted = await db.pageView.deleteMany({ where })
    if (userId) await db.loginEvent.deleteMany({ where: { userId } }).catch(() => {})

    return NextResponse.json({ deleted: deleted.count, ok: true })
}
