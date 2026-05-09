import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

const RETENTION_DAYS = 90

function aggregateByMethod(events: { method: string; userId: string }[]) {
    const map = new Map<string, Set<string>>()
    for (const e of events) {
        if (!map.has(e.method)) map.set(e.method, new Set())
        map.get(e.method)!.add(e.userId)
    }
    return Array.from(map.entries())
        .map(([method, users]) => ({ method, uniqueUsers: users.size }))
        .sort((a, b) => b.uniqueUsers - a.uniqueUsers)
}

export async function GET(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { searchParams } = new URL(req.url)
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '30'))
    const db = prisma as any

    const now   = new Date()
    const fiveMin = new Date(now.getTime() - 5  * 60 * 1000)
    const today   = new Date(now); today.setHours(0, 0, 0, 0)
    const week    = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
    const month   = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
        rawFeed, onlineNowRows, loggedInNowRows,
        countryBreakdown, topPagesWithDuration,
        rawLoginEvents,
        authEventsToday, authEventsWeek, authEventsMonth,
        funnelVisit, funnelCasting, funnelApplyStart, funnelApplySubmit, funnelConverted,
        hourlyRaw, retentionCount,
    ] = await Promise.all([
        db.pageView.findMany({
            orderBy: { createdAt: 'desc' }, take: limit,
            select: { id: true, path: true, device: true, country: true, sessionId: true, referrer: true, event: true, durationMs: true, createdAt: true, userId: true },
        }),
        db.pageView.findMany({ where: { createdAt: { gte: fiveMin } }, distinct: ['sessionId'], select: { sessionId: true, userId: true } }),
        db.pageView.findMany({ where: { createdAt: { gte: fiveMin }, userId: { not: null } }, distinct: ['userId'], select: { userId: true } }),
        db.pageView.groupBy({ by: ['country'], where: { createdAt: { gte: month }, country: { not: null } }, _count: { country: true }, orderBy: { _count: { country: 'desc' } }, take: 15 }),
        db.pageView.groupBy({ by: ['path'], where: { createdAt: { gte: week } }, _count: { path: true }, _avg: { durationMs: true }, orderBy: { _count: { path: 'desc' } }, take: 10 }),
        // Fetch more login events to deduplicate by user
        db.loginEvent.findMany({
            orderBy: { createdAt: 'desc' }, take: 200,
            select: { id: true, userId: true, method: true, country: true, createdAt: true },
        }).catch(() => []),
        // Auth methods: unique users per period
        db.loginEvent.findMany({ where: { createdAt: { gte: today } }, select: { method: true, userId: true } }).catch(() => []),
        db.loginEvent.findMany({ where: { createdAt: { gte: week  } }, select: { method: true, userId: true } }).catch(() => []),
        db.loginEvent.findMany({ where: { createdAt: { gte: month } }, select: { method: true, userId: true } }).catch(() => []),
        db.pageView.findMany({ where: { createdAt: { gte: month } }, distinct: ['sessionId'], select: { sessionId: true } }),
        db.pageView.findMany({ where: { createdAt: { gte: month }, path: { startsWith: '/casting' } }, distinct: ['sessionId'], select: { sessionId: true } }),
        db.pageView.findMany({ where: { createdAt: { gte: month }, event: 'apply_start' }, distinct: ['sessionId'], select: { sessionId: true } }),
        db.pageView.findMany({ where: { createdAt: { gte: month }, event: 'apply_submit' }, distinct: ['sessionId'], select: { sessionId: true } }),
        db.user.count({ where: { createdAt: { gte: month } } }),
        db.pageView.findMany({ where: { createdAt: { gte: today } }, select: { createdAt: true } }),
        db.pageView.count({ where: { createdAt: { lt: new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000) } } }),
    ])

    // Resolve identities for live feed
    const userIds = [...new Set(rawFeed.filter((r: any) => r.userId).map((r: any) => r.userId as string))]
    const users = userIds.length > 0
        ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true, role: true, loginMethod: true, avatar: true } })
        : []
    const userMap = new Map(users.map((u: any) => [u.id, u]))

    // Deduplicate login events by userId — one entry per unique user
    const loginUserMap = new Map<string, {
        userId: string | null; method: string; country: string | null
        lastLogin: Date; loginCount: number
        loginHistory: { id: string; createdAt: string; country: string | null; method: string }[]
    }>()
    for (const e of rawLoginEvents) {
        const key = e.userId || `anon-${e.id}`
        const hist = { id: e.id, createdAt: e.createdAt.toISOString(), country: e.country, method: e.method }
        if (!loginUserMap.has(key)) {
            loginUserMap.set(key, { userId: e.userId, method: e.method, country: e.country, lastLogin: e.createdAt, loginCount: 1, loginHistory: [hist] })
        } else {
            const entry = loginUserMap.get(key)!
            entry.loginCount++
            entry.loginHistory.push(hist)
            if (e.createdAt > entry.lastLogin) { entry.lastLogin = e.createdAt; entry.method = e.method; entry.country = e.country }
        }
    }
    const uniqueLoginUserIds = [...new Set(
        Array.from(loginUserMap.values()).map(e => e.userId).filter(Boolean) as string[]
    )]
    const loginUsers = uniqueLoginUserIds.length > 0
        ? await db.user.findMany({ where: { id: { in: uniqueLoginUserIds } }, select: { id: true, name: true, email: true, role: true } })
        : []
    const loginUserResolveMap = new Map(loginUsers.map((u: any) => [u.id, u]))

    const recentLogins = Array.from(loginUserMap.values())
        .sort((a, b) => b.lastLogin.getTime() - a.lastLogin.getTime())
        .slice(0, 20)
        .map(e => {
            const u = e.userId ? (loginUserResolveMap.get(e.userId) as any) : null
            return {
                userId: e.userId,
                method: e.method,
                country: e.country,
                lastLogin: e.lastLogin.toISOString(),
                loginCount: e.loginCount,
                loginHistory: e.loginHistory.slice(0, 20),
                user: u ? { name: u.name, email: u.email, role: u.role } : null,
            }
        })

    // Enrich live feed
    const feed = rawFeed.map((row: any) => {
        const user = row.userId ? (userMap.get(row.userId) as any) || null : null
        return {
            id: row.id, path: row.path, device: row.device, country: row.country,
            sessionId: row.sessionId, referrer: row.referrer, event: row.event,
            durationMs: row.durationMs, createdAt: row.createdAt.toISOString(),
            identity: user ? {
                name: user.name, email: user.email, role: user.role,
                loginMethod: user.loginMethod, avatar: user.avatar,
                initials: user.name?.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase() || '?',
            } : null,
        }
    })

    const hourlyViews = new Array(24).fill(0)
    for (const pv of hourlyRaw) hourlyViews[new Date(pv.createdAt).getHours()]++

    const geo = countryBreakdown.map((g: any) => ({ country: g.country, count: g._count.country }))
    const topPages = topPagesWithDuration.map((p: any) => ({ path: p.path, views: p._count.path, avgDurationMs: p._avg.durationMs ? Math.round(p._avg.durationMs) : null }))

    const funnel = [
        { step: 'Any Visit',     count: funnelVisit.length,       pct: 100 },
        { step: 'Casting Page',  count: funnelCasting.length,     pct: funnelVisit.length > 0 ? Math.round((funnelCasting.length / funnelVisit.length) * 100) : 0 },
        { step: 'Apply Started', count: funnelApplyStart.length,  pct: funnelVisit.length > 0 ? Math.round((funnelApplyStart.length / funnelVisit.length) * 100) : 0 },
        { step: 'Apply Submit',  count: funnelApplySubmit.length, pct: funnelVisit.length > 0 ? Math.round((funnelApplySubmit.length / funnelVisit.length) * 100) : 0 },
        { step: 'Converted',     count: funnelConverted,          pct: funnelVisit.length > 0 ? Math.round((funnelConverted / funnelVisit.length) * 100) : 0 },
    ]

    return NextResponse.json({
        feed,
        realTime: { onlineNow: onlineNowRows.length, loggedInNow: loggedInNowRows.length, guestsNow: onlineNowRows.length - loggedInNowRows.length },
        onlineSessions: onlineNowRows.map((r: any) => r.sessionId).filter(Boolean),
        geo,
        topPages,
        authMethodsToday: aggregateByMethod(authEventsToday),
        authMethodsWeek:  aggregateByMethod(authEventsWeek),
        authMethodsMonth: aggregateByMethod(authEventsMonth),
        recentLogins,
        funnel,
        hourlyViews,
        retentionWarning: retentionCount > 0 ? retentionCount : 0,
        retention: { days: RETENTION_DAYS },
    })
}

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
