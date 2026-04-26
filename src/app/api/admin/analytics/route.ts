import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { callGemini } from '@/lib/gemini'

// ═══════════════════════════════════════════════════════
// Helper: build 7-day date buckets and fill from raw data
// ═══════════════════════════════════════════════════════
function buildWeekBuckets(today: Date) {
    const buckets: { date: string; start: Date; end: Date }[] = []
    for (let i = 6; i >= 0; i--) {
        const start = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
        buckets.push({ date: start.toISOString().split('T')[0], start, end })
    }
    return buckets
}

function fillBuckets(buckets: { date: string }[], rawRows: { createdAt: Date }[]) {
    const countMap = new Map<string, number>()
    for (const row of rawRows) {
        const key = new Date(row.createdAt).toISOString().split('T')[0]
        countMap.set(key, (countMap.get(key) || 0) + 1)
    }
    return buckets.map(b => countMap.get(b.date) || 0)
}

// ═══════════════════════════════════════════════════════
// GET — Section-based analytics data
// Accepts ?section=core|traffic|content  (default: all)
// ═══════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
    const section = req.nextUrl.searchParams.get('section') || 'all'

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
    const week = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const month = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    const fiveMin = new Date(now.getTime() - 5 * 60 * 1000)

    const result: Record<string, unknown> = {}

    // ─── CORE section (always loaded — lightweight counts) ───
    if (section === 'all' || section === 'core') {
        const [
            onlineNow, loggedInNow, todayViews, yesterdayViews,
            totalUsers, newUsersMonth,
            totalApps, appsMonth,
            totalDonations, donationsMonth,
            subscribers, mailingList, filmViews, castingPageViews,
            trailerCount, trailerViews,
            // Dashboard data (merged from separate endpoint)
            projectCount, castingCount, pendingCount, reviewedCount,
            recentApplications,
            // Script submissions
            scriptSubmissionCount, pendingScriptReviews,
            recentScriptSubmissions,
        ] = await Promise.all([
            prisma.pageView.findMany({
                where: { createdAt: { gte: fiveMin } },
                distinct: ['userId'],
                select: { userId: true },
            }),
            // Logged-in users active in the last 5 min (non-null userId only)
            prisma.pageView.findMany({
                where: { createdAt: { gte: fiveMin }, userId: { not: null } },
                distinct: ['userId'],
                select: { userId: true },
            }),
            prisma.pageView.count({ where: { createdAt: { gte: today } } }),
            prisma.pageView.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
            prisma.user.count(),
            prisma.user.count({ where: { createdAt: { gte: month } } }),
            prisma.application.count(),
            prisma.application.count({ where: { createdAt: { gte: month } } }),
            prisma.donation.count({ where: { status: 'completed' } }).catch(() => 0),
            prisma.donation.count({ where: { status: 'completed', createdAt: { gte: month } } }).catch(() => 0),
            // Subscribers = verified registered users (industry standard)
            prisma.user.count({ where: { emailVerified: true } }),
            // Mailing list = newsletter-only signups (footer form, no account required)
            prisma.subscriber.count({ where: { active: true } }),
            prisma.filmView.count(),
            prisma.pageView.count({
                where: { createdAt: { gte: month }, path: { startsWith: '/casting' } },
            }),
            // Trailer analytics
            prisma.project.count({ where: { trailerUrl: { not: null } } }),
            prisma.pageView.count({
                where: { createdAt: { gte: month }, path: { contains: 'trailer' } },
            }),
            // Dashboard counts
            prisma.project.count(),
            prisma.castingCall.count({ where: { status: 'open' } }),
            prisma.application.count({ where: { status: 'submitted' } }),
            prisma.application.count({ where: { status: { not: 'submitted' }, createdAt: { gte: month } } }),
            prisma.application.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true, fullName: true, status: true, aiScore: true, createdAt: true,
                    castingCall: { select: { roleName: true, project: { select: { title: true } } } },
                },
            }),
            // Script submissions
            prisma.scriptSubmission.count(),
            prisma.scriptSubmission.count({ where: { status: 'submitted' } }),
            prisma.scriptSubmission.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true, authorName: true, title: true, status: true, createdAt: true,
                    scriptCall: { select: { title: true } },
                },
            }),
        ])

        const conversionRate = castingPageViews > 0 ? ((appsMonth / castingPageViews) * 100) : 0

        // Sparklines — 3 parallel Prisma queries using date ranges, NOT 21 sequential ones
        const buckets = buildWeekBuckets(today)
        const [viewRows, userRows, appRows] = await Promise.all([
            prisma.pageView.findMany({
                where: { createdAt: { gte: week } },
                select: { createdAt: true },
            }),
            prisma.user.findMany({
                where: { createdAt: { gte: week } },
                select: { createdAt: true },
            }),
            prisma.application.findMany({
                where: { createdAt: { gte: week } },
                select: { createdAt: true },
            }),
        ])

        const dailyViews = buckets.map((b, i) => ({
            date: b.date,
            views: fillBuckets(buckets, viewRows)[i],
        }))

        // Resolve names of currently-active logged-in users.
        // Cap at 20 to avoid O(N) DB round-trips when thousands are online —
        // the full count is already captured in loggedInNow.length.
        const SHOW_LIMIT = 20
        const activeUserIds = loggedInNow.map(pv => pv.userId as string)
        const activeUsers = activeUserIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: activeUserIds.slice(0, SHOW_LIMIT) } },
                select: { id: true, name: true },
                take: SHOW_LIMIT,
            })
            : []

        result.realTime = {
            onlineNow: onlineNow.length,
            loggedInNow: loggedInNow.length,
            activeUsers: activeUsers.map(u => ({ name: u.name })),
            hasMoreUsers: loggedInNow.length > SHOW_LIMIT,
            todayViews,
            yesterdayViews,
        }
        result.engagement = {
            totalUsers,
            newUsersMonth,
            totalApps,
            appsMonth,
            totalDonations,
            donationsMonth,
            subscribers,       // verified registered users (industry standard)
            mailingList,       // active newsletter-only signups
            trailerCount,      // projects that have a trailer
            trailerViews,      // trailer-related page views this month
            conversionRate: Math.round(conversionRate * 10) / 10,
            castingViews: castingPageViews,
        }
        result.content = {
            totalFilmViews: filmViews,
            topFilms: [], // enriched in traffic section or when section=all
        }
        result.sparklines = {
            views: fillBuckets(buckets, viewRows),
            users: fillBuckets(buckets, userRows),
            apps: fillBuckets(buckets, appRows),
        }
        result.traffic = {
            dailyViews,
        }
        // Dashboard data (merged)
        result.dashboard = {
            projectCount,
            castingCount,
            applicationCount: totalApps,
            pendingCount,
            reviewedCount,
            recentApplications: recentApplications.map(app => ({
                id: app.id,
                fullName: app.fullName,
                status: app.status,
                aiScore: app.aiScore,
                createdAt: app.createdAt.toISOString(),
                castingCall: {
                    roleName: app.castingCall.roleName,
                    project: { title: app.castingCall.project.title },
                },
            })),
            scriptSubmissionCount,
            pendingScriptReviews,
            recentScriptSubmissions: recentScriptSubmissions.map(s => ({
                id: s.id,
                authorName: s.authorName,
                title: s.title,
                status: s.status,
                createdAt: s.createdAt.toISOString(),
                scriptCallTitle: s.scriptCall?.title ?? null,
            })),
        }

        // ── Email delivery stats ──
        try {
            const [emailTotal, emailToday, emailMonth, emailFailed, emailByType] = await Promise.all([
                prisma.emailLog.count(),
                prisma.emailLog.count({ where: { sentAt: { gte: today } } }),
                prisma.emailLog.count({ where: { sentAt: { gte: month } } }),
                prisma.emailLog.count({ where: { success: false, sentAt: { gte: month } } }),
                prisma.emailLog.groupBy({
                    by: ['type'],
                    where: { sentAt: { gte: month } },
                    _count: { type: true },
                    orderBy: { _count: { type: 'desc' } },
                }),
            ])
            result.email = {
                total: emailTotal,
                today: emailToday,
                thisMonth: emailMonth,
                failedMonth: emailFailed,
                successRate: emailMonth > 0 ? Math.round(((emailMonth - emailFailed) / emailMonth) * 100) : 100,
                byType: emailByType.map(r => ({ type: r.type, count: r._count.type })),
            }
        } catch {
            // EmailLog table not yet in DB (first deploy) — provide empty stats
            result.email = { total: 0, today: 0, thisMonth: 0, failedMonth: 0, successRate: 100, byType: [] }
        }
    }

    // ─── TRAFFIC section (heavier — groupBy, heatmap) ───
    if (section === 'all' || section === 'traffic') {
        const [
            weekViews, monthViews,
            topPages, deviceBreakdown, referrerBreakdown,
            recentActivity,
        ] = await Promise.all([
            prisma.pageView.count({ where: { createdAt: { gte: week } } }),
            prisma.pageView.count({ where: { createdAt: { gte: month } } }),
            prisma.pageView.groupBy({
                by: ['path'],
                where: { createdAt: { gte: month } },
                _count: { path: true },
                orderBy: { _count: { path: 'desc' } },
                take: 10,
            }),
            prisma.pageView.groupBy({
                by: ['device'],
                where: { createdAt: { gte: month } },
                _count: { device: true },
            }),
            prisma.pageView.groupBy({
                by: ['referrer'],
                where: { createdAt: { gte: month }, referrer: { not: null } },
                _count: { referrer: true },
                orderBy: { _count: { referrer: 'desc' } },
                take: 8,
            }),
            prisma.pageView.findMany({
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: { id: true, path: true, device: true, createdAt: true, referrer: true },
            }),
        ])

        // Hourly heatmap — server-side aggregation instead of loading all rows
        const todayPVs = await prisma.pageView.findMany({
            where: { createdAt: { gte: today } },
            select: { createdAt: true },
        })
        const hourlyViews: number[] = new Array(24).fill(0)
        for (const pv of todayPVs) {
            hourlyViews[new Date(pv.createdAt).getHours()]++
        }

        // Parse referrers into domains
        const referrerSources = referrerBreakdown
            .filter(r => r.referrer)
            .map(r => {
                let domain = 'Direct'
                try {
                    const url = new URL(r.referrer!)
                    domain = url.hostname.replace('www.', '')
                } catch {
                    domain = (r.referrer || 'Direct').slice(0, 40)
                }
                return { source: domain, count: r._count.referrer }
            })
            .reduce((acc, curr) => {
                const existing = acc.find(a => a.source === curr.source)
                if (existing) existing.count += curr.count
                else acc.push({ ...curr })
                return acc
            }, [] as { source: string; count: number }[])
            .sort((a, b) => b.count - a.count)
            .slice(0, 6)

        // Merge into traffic (may already have dailyViews from core)
        const existingTraffic = (result.traffic || {}) as Record<string, unknown>
        result.traffic = {
            ...existingTraffic,
            weekViews,
            monthViews,
            topPages: topPages.map(p => ({ path: p.path, views: p._count.path })),
            devices: deviceBreakdown.map(d => ({ device: d.device || 'unknown', count: d._count.device })),
            hourlyViews,
            referrerSources,
        }

        result.recentActivity = recentActivity.map(a => ({
            id: a.id,
            path: a.path,
            device: a.device,
            createdAt: a.createdAt.toISOString(),
            referrer: a.referrer,
        }))
    }

    // ─── CONTENT section (top films + time-based views + trailer analytics) ───
    if (section === 'all' || section === 'content') {
        const [
            topFilms,
            filmViewsToday, filmViewsWeek, filmViewsMonth, filmViewsAllTime,
            trailerProjectCount,
            trailerViewsToday, trailerViewsWeek, trailerViewsMonth, trailerViewsAllTime,
        ] = await Promise.all([
            prisma.filmView.groupBy({
                by: ['projectId'],
                _count: { projectId: true },
                orderBy: { _count: { projectId: 'desc' } },
                take: 10,
            }),
            // Film views by period
            prisma.filmView.count({ where: { createdAt: { gte: today } } }),
            prisma.filmView.count({ where: { createdAt: { gte: week } } }),
            prisma.filmView.count({ where: { createdAt: { gte: month } } }),
            prisma.filmView.count(),
            // Trailer stats
            prisma.project.count({ where: { trailerUrl: { not: null } } }),
            prisma.pageView.count({ where: { createdAt: { gte: today }, path: { contains: 'trailer' } } }),
            prisma.pageView.count({ where: { createdAt: { gte: week }, path: { contains: 'trailer' } } }),
            prisma.pageView.count({ where: { createdAt: { gte: month }, path: { contains: 'trailer' } } }),
            prisma.pageView.count({ where: { path: { contains: 'trailer' } } }),
        ])

        const projectIds = topFilms.map(f => f.projectId)
        const [projects, weeklyFilmViews] = await Promise.all([
            projectIds.length > 0
                ? prisma.project.findMany({
                    where: { id: { in: projectIds } },
                    select: { id: true, title: true, slug: true, coverImage: true, trailerUrl: true },
                })
                : [],
            // Per-film weekly views for trend badges
            projectIds.length > 0
                ? prisma.filmView.groupBy({
                    by: ['projectId'],
                    where: { createdAt: { gte: week }, projectId: { in: projectIds } },
                    _count: { projectId: true },
                })
                : [],
        ])

        const weeklyMap = new Map(weeklyFilmViews.map(f => [f.projectId, f._count.projectId]))

        // Top trailers (projects with trailerUrl that have views)
        const trailerProjects = projects.filter(p => p.trailerUrl)
        const topTrailers = trailerProjects.map(p => {
            const filmData = topFilms.find(f => f.projectId === p.id)
            return { title: p.title, views: filmData?._count.projectId || 0 }
        }).sort((a, b) => b.views - a.views).slice(0, 5)

        const existingContent = (result.content || {}) as Record<string, unknown>
        result.content = {
            ...existingContent,
            topFilms: topFilms.map(f => ({
                views: f._count.projectId,
                weekViews: weeklyMap.get(f.projectId) || 0,
                project: projects.find(p => p.id === f.projectId) || { title: 'Unknown', slug: '', coverImage: null, trailerUrl: null },
            })),
            viewsByPeriod: {
                today: filmViewsToday,
                week: filmViewsWeek,
                month: filmViewsMonth,
                allTime: filmViewsAllTime,
            },
            trailerStats: {
                totalTrailers: trailerProjectCount,
                views: {
                    today: trailerViewsToday,
                    week: trailerViewsWeek,
                    month: trailerViewsMonth,
                    allTime: trailerViewsAllTime,
                },
                topTrailers,
            },
        }
    }

    // ─── TRAINING section (course analytics) ───
    if (section === 'all' || section === 'training') {
        try {
        const [
            totalCourses, publishedCourses,
            totalEnrollments, completedEnrollments,
            recentEnrollments,
            popularCourses,
            activeStudents,
        ] = await Promise.all([
            prisma.course.count(),
            prisma.course.count({ where: { published: true } }),
            prisma.enrollment.count(),
            prisma.enrollment.count({ where: { completedAt: { not: null } } }),
            prisma.enrollment.findMany({
                take: 10,
                orderBy: { enrolledAt: 'desc' },
                include: {
                    user: { select: { name: true, email: true } },
                    course: { select: { title: true } },
                },
            }),
            prisma.course.findMany({
                where: { published: true },
                orderBy: { sortOrder: 'asc' },
                include: {
                    _count: { select: { enrollments: true } },
                    enrollments: { where: { completedAt: { not: null } }, select: { id: true } },
                },
            }),
            prisma.enrollment.groupBy({
                by: ['userId'],
                where: { enrolledAt: { gte: week } },
                _count: { userId: true },
            }),
        ])

        result.training = {
            totalCourses,
            publishedCourses,
            totalEnrollments,
            completedEnrollments,
            completionRate: totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0,
            activeStudents: activeStudents.length,
            popularCourses: popularCourses.map(c => ({
                title: c.title,
                enrollments: c._count.enrollments,
                completions: c.enrollments.length,
                completionRate: c._count.enrollments > 0 ? Math.round((c.enrollments.length / c._count.enrollments) * 100) : 0,
            })),
            recentActivity: recentEnrollments.map(e => ({
                user: e.user.name,
                course: e.course.title,
                enrolledAt: e.enrolledAt.toISOString(),
                completed: !!e.completedAt,
            })),
            badgeDistribution: [], // TrainingBadge model not yet in schema
        }
        } catch (trainingErr) {
            console.warn('Training analytics skipped (schema mismatch?):', trainingErr)
            result.training = {
                totalCourses: 0, publishedCourses: 0,
                totalEnrollments: 0, completedEnrollments: 0,
                completionRate: 0, activeStudents: 0,
                popularCourses: [], recentActivity: [], badgeDistribution: [],
            }
        }
    }

    return NextResponse.json(result)
    } catch (err) {
        console.error('Analytics GET error:', err)
        return NextResponse.json(
            { error: 'Analytics query failed', details: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        )
    }
}

// ═══════════════════════════════════════════════════════
// POST — generate AI insights (unchanged structurally)
// ═══════════════════════════════════════════════════════
export async function POST() {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const week = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const prevWeek = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)
    const month = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
        monthViews, weekViews, prevWeekViews,
        totalUsers, newUsersMonth,
        totalApps, appsMonth, appsWeek,
        openCastings, totalCastings,
        subscribers, filmViews,
        topPages, deviceBreakdown, referrerBreakdown,
        appsByStatus, topFilmsRaw,
    ] = await Promise.all([
        prisma.pageView.count({ where: { createdAt: { gte: month } } }),
        prisma.pageView.count({ where: { createdAt: { gte: week } } }),
        prisma.pageView.count({ where: { createdAt: { gte: prevWeek, lt: week } } }),
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: month } } }),
        prisma.application.count(),
        prisma.application.count({ where: { createdAt: { gte: month } } }),
        prisma.application.count({ where: { createdAt: { gte: week } } }),
        prisma.castingCall.count({ where: { status: 'open' } }),
        prisma.castingCall.count(),
        prisma.user.count({ where: { emailVerified: true } }),
        prisma.filmView.count(),
        prisma.pageView.groupBy({
            by: ['path'], where: { createdAt: { gte: month } },
            _count: { path: true }, orderBy: { _count: { path: 'desc' } }, take: 8,
        }),
        prisma.pageView.groupBy({
            by: ['device'], where: { createdAt: { gte: month } },
            _count: { device: true },
        }),
        prisma.pageView.groupBy({
            by: ['referrer'], where: { createdAt: { gte: month }, referrer: { not: null } },
            _count: { referrer: true }, orderBy: { _count: { referrer: 'desc' } }, take: 5,
        }),
        prisma.application.groupBy({
            by: ['status'], _count: { status: true },
        }),
        prisma.filmView.groupBy({
            by: ['projectId'], _count: { projectId: true },
            orderBy: { _count: { projectId: 'desc' } }, take: 5,
        }),
    ])

    const projectIds = topFilmsRaw.map(f => f.projectId)
    const projects = projectIds.length > 0
        ? await prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, title: true } })
        : []
    const topFilms = topFilmsRaw.map(f => ({
        title: projects.find(p => p.id === f.projectId)?.title || 'Unknown',
        views: f._count.projectId,
    }))

    const castingPageViews = topPages.find(p => p.path.startsWith('/casting'))?._count?.path || 0
    const conversionRate = castingPageViews > 0 ? ((appsMonth / castingPageViews) * 100).toFixed(1) : '0'
    const wowChange = prevWeekViews > 0 ? (((weekViews - prevWeekViews) / prevWeekViews) * 100).toFixed(1) : 'N/A'

    const topReferrers = referrerBreakdown.map(r => {
        try { return new URL(r.referrer!).hostname.replace('www.', '') } catch { return r.referrer || 'direct' }
    }).join(', ')

    const prompt = `You are a data analyst and growth advisor for AIM Studio — an AI-powered independent film production platform where people apply for roles, watch films, and follow active productions.

Your job is to analyze the real platform data below and produce 5-7 specific, actionable insights tailored to this studio's context. Reference actual numbers. Do NOT give generic advice.

## PLATFORM DATA (Last 30 Days)

### Traffic
- Page views (30d): ${monthViews}
- Page views this week: ${weekViews} (vs last week: ${prevWeekViews}, ${wowChange}% change)
- Top pages: ${topPages.map(p => `"${p.path}" — ${p._count.path} views`).join(' | ')}
- Device split: ${deviceBreakdown.map(d => `${d.device || 'unknown'}: ${d._count.device}`).join(', ')}
- Top traffic sources: ${topReferrers || 'mostly direct'}

### Users & Engagement
- Total registered users: ${totalUsers} (${newUsersMonth} new this month)
- Verified subscribers (registered users): ${subscribers}
- Film views (all time): ${filmViews}
- Top watched films: ${topFilms.map(f => `"${f.title}" (${f.views} views)`).join(', ') || 'no data yet'}

### Casting
- Open casting calls: ${openCastings} of ${totalCastings} total
- Applications this month: ${appsMonth} | this week: ${appsWeek} | all time: ${totalApps}
- Application pipeline: ${appsByStatus.map(s => `${s.status}: ${s._count.status}`).join(', ')}
- Casting page views: ${castingPageViews} → conversion rate to application: ${conversionRate}%

## TASK
Return a JSON array of 5-7 insight objects. Each must be specific to the numbers above.
Types: "trend" (observation), "recommendation" (action to take), "alert" (something needs attention), "win" (positive highlight).

Required fields: "type", "title" (max 8 words), "description" (2-3 sentences using actual numbers).

Only return the JSON array, no markdown, no extra text.`

    const aiResult = await callGemini(prompt, 'analytics')

    if ('error' in aiResult) {
        return NextResponse.json({ insights: [], error: aiResult.error })
    }

    try {
        const jsonMatch = aiResult.text.match(/\[[\s\S]*\]/)
        const insights = jsonMatch ? JSON.parse(jsonMatch[0]) : []
        return NextResponse.json({ insights, keyUsed: aiResult.keyLabel })
    } catch {
        return NextResponse.json({
            insights: [{ type: 'alert', title: 'Analysis Complete', description: aiResult.text }],
            keyUsed: aiResult.keyLabel,
        })
    }
}
