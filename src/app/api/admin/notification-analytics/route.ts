import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

// ── GET /api/admin/notification-analytics ────────────────────────────────────
// Cross-film notification signup analytics dashboard data.
export async function GET() {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
        totalSignups,
        signupsLast7,
        signupsLast30,
        signupsByTag,
        recentByTag,
        languageDist,
        countryDist,
        signupsByType,
        activeCtas,
        // Phase 2: new breakdowns
        requestSourceDist,
        sourceTypeDist,
        requestedByDist,
        statusDist,
    ] = await Promise.all([
        // Total platform-wide signups
        prisma.notificationSignup.count(),
        // Last 7 days
        prisma.notificationSignup.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        // Last 30 days
        prisma.notificationSignup.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        // Signups grouped by tag (top films by total signups)
        prisma.notificationSignup.groupBy({
            by: ['signupTag'],
            _count: true,
            orderBy: { _count: { signupTag: 'desc' } },
            take: 10,
        }),
        // Signups in last 7 days by tag (fastest-growing)
        prisma.notificationSignup.groupBy({
            by: ['signupTag'],
            where: { createdAt: { gte: sevenDaysAgo } },
            _count: true,
            orderBy: { _count: { signupTag: 'desc' } },
            take: 10,
        }),
        // Language distribution
        prisma.notificationSignup.groupBy({
            by: ['language'],
            _count: true,
            orderBy: { _count: { language: 'desc' } },
        }),
        // Country distribution (top 20)
        prisma.notificationSignup.groupBy({
            by: ['country'],
            where: { country: { not: null } },
            _count: true,
            orderBy: { _count: { country: 'desc' } },
            take: 20,
        }),
        // By notification type
        prisma.notificationSignup.groupBy({
            by: ['notificationType'],
            _count: true,
        }),
        // Active CTAs count
        prisma.ctaConfiguration.count({ where: { status: 'active' } }),
        // ── Phase 2 breakdowns ─────────────────────────────────────────────
        // By requestSource
        prisma.notificationSignup.groupBy({
            by: ['requestSource'],
            _count: true,
            orderBy: { _count: { requestSource: 'desc' } },
        }),
        // By sourceType
        prisma.notificationSignup.groupBy({
            by: ['sourceType'],
            _count: true,
            orderBy: { _count: { sourceType: 'desc' } },
        }),
        // By requestedBy
        prisma.notificationSignup.groupBy({
            by: ['requestedBy'],
            _count: true,
            orderBy: { _count: { requestedBy: 'desc' } },
        }),
        // By status
        prisma.notificationSignup.groupBy({
            by: ['status'],
            _count: true,
            orderBy: { _count: { status: 'desc' } },
        }),
    ])

    // Resolve project titles for the top tags
    const allTags = [...new Set([
        ...signupsByTag.map(s => s.signupTag),
        ...recentByTag.map(s => s.signupTag),
    ])]
    const ctaConfigs = await prisma.ctaConfiguration.findMany({
        where: { signupTag: { in: allTags } },
        select: { signupTag: true, videoId: true, notificationType: true },
    })
    const videoIds = [...new Set(ctaConfigs.map(c => c.videoId))]
    const projects = await prisma.project.findMany({
        where: { id: { in: videoIds } },
        select: { id: true, title: true, slug: true },
    })
    const projectMap = new Map(projects.map(p => [p.id, p]))
    const tagToProject = new Map(ctaConfigs.map(c => [c.signupTag, {
        project: projectMap.get(c.videoId),
        type: c.notificationType,
    }]))

    const enrichTag = (tag: string, count: number) => {
        const info = tagToProject.get(tag)
        return {
            signupTag: tag,
            count,
            projectTitle: info?.project?.title || tag,
            projectSlug: info?.project?.slug || '',
            notificationType: info?.type || 'unknown',
        }
    }

    return NextResponse.json({
        totalSignups,
        signupsLast7Days: signupsLast7,
        signupsLast30Days: signupsLast30,
        activeCtas,
        topFilmsBySignups: signupsByTag.map(s => enrichTag(s.signupTag, s._count)),
        topFilmsByVelocity: recentByTag.map(s => enrichTag(s.signupTag, s._count)),
        languageDistribution: languageDist.map(l => ({ language: l.language, count: l._count })),
        countryDistribution: countryDist.map(c => ({ country: c.country || 'Unknown', count: c._count })),
        signupsByType: signupsByType.map(t => ({ type: t.notificationType, count: t._count })),
        // Phase 2 breakdowns
        requestSourceDistribution: requestSourceDist.map(r => ({ source: r.requestSource || 'unknown', count: r._count })),
        sourceTypeDistribution: sourceTypeDist.map(s => ({ type: s.sourceType || 'unknown', count: s._count })),
        requestedByDistribution: requestedByDist.map(r => ({ by: r.requestedBy || 'unknown', count: r._count })),
        statusDistribution: statusDist.map(s => ({ status: s.status, count: s._count })),
    })
}
