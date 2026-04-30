import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'

function isAdmin(role: string) {
    return role === 'admin' || role === 'superadmin'
}

const CATEGORY_LABELS: Record<string, string> = {
    action: 'Action / Thriller',
    drama: 'Drama & Family',
    documentary: 'Documentary',
    horror: 'Horror',
    romance: 'Romance',
    shorts: 'Short Films',
    all: 'All of the above',
}

export async function GET(req: Request) {
    const session = await getUserSession()
    if (!session?.userId || !isAdmin(session.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const url = new URL(req.url)
        const ftPage = parseInt(url.searchParams.get('ftPage') || '1')
        const rrPage = parseInt(url.searchParams.get('rrPage') || '1')
        const ftFilter = url.searchParams.get('ftFilter') || 'all' // all | flagged | clean
        const ftLimit = 20
        const rrLimit = 50

        // Get the active survey
        const survey = await prisma.survey.findFirst({
            where: { active: true },
            orderBy: { createdAt: 'desc' },
        })

        if (!survey) {
            return NextResponse.json({
                totalResponses: 0,
                responsesLast24h: 0,
                conversionRate: 0,
                convertedCount: 0,
                categoryBreakdown: [],
                freeTextResponses: [],
                freeTextTotal: 0,
                freeTextFlaggedCount: 0,
                recentResponses: [],
                recentTotal: 0,
                surveyId: null,
            })
        }

        // ── Aggregate counts efficiently ──
        const [totalResponses, responsesLast24h, convertedCount] = await Promise.all([
            prisma.surveyResponse.count({ where: { surveyId: survey.id } }),
            prisma.surveyResponse.count({
                where: { surveyId: survey.id, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
            }),
            prisma.surveyResponse.count({ where: { surveyId: survey.id, converted: true } }),
        ])

        const conversionRate = totalResponses > 0 ? Math.round((convertedCount / totalResponses) * 1000) / 10 : 0

        // ── Category breakdown — fetch all selections only ──
        const allSelections = await prisma.surveyResponse.findMany({
            where: { surveyId: survey.id },
            select: { selections: true },
        })
        const categoryCounts: Record<string, number> = {}
        for (const r of allSelections) {
            for (const sel of r.selections) {
                categoryCounts[sel] = (categoryCounts[sel] || 0) + 1
            }
        }
        const categoryBreakdown = Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
            key,
            label,
            count: categoryCounts[key] || 0,
            percentage: totalResponses > 0 ? Math.round(((categoryCounts[key] || 0) / totalResponses) * 1000) / 10 : 0,
        })).sort((a, b) => b.count - a.count)

        // ── Free text — server-paginated ──
        const ftWhere: Record<string, unknown> = { surveyId: survey.id, freeText: { not: null } }
        if (ftFilter === 'flagged') ftWhere.flagged = true
        else if (ftFilter === 'clean') ftWhere.flagged = false

        const [freeTextTotal, freeTextFlaggedCount, freeTextRows] = await Promise.all([
            prisma.surveyResponse.count({ where: { surveyId: survey.id, freeText: { not: null } } }),
            prisma.surveyResponse.count({ where: { surveyId: survey.id, freeText: { not: null }, flagged: true } }),
            prisma.surveyResponse.findMany({
                where: ftWhere,
                orderBy: { createdAt: 'desc' },
                take: ftLimit,
                skip: (ftPage - 1) * ftLimit,
                select: { id: true, freeText: true, country: true, createdAt: true, flagged: true },
            }),
        ])

        const freeTextResponses = freeTextRows.map(r => ({
            id: r.id,
            text: r.freeText!,
            createdAt: r.createdAt.toISOString(),
            country: r.country,
            flagged: r.flagged,
        }))

        // ── Recent responses — server-paginated ──
        const recentTotal = totalResponses
        const recentRows = await prisma.surveyResponse.findMany({
            where: { surveyId: survey.id },
            orderBy: { createdAt: 'desc' },
            take: rrLimit,
            skip: (rrPage - 1) * rrLimit,
            select: { email: true, selections: true, country: true, createdAt: true, flagged: true },
        })

        const recentResponses = recentRows.map(r => ({
            email: r.email ? maskEmail(r.email) : null,
            selections: r.selections,
            country: r.country,
            createdAt: r.createdAt.toISOString(),
            flagged: r.flagged,
        }))

        return NextResponse.json({
            totalResponses,
            responsesLast24h,
            conversionRate,
            convertedCount,
            categoryBreakdown,
            freeTextResponses,
            freeTextTotal,
            freeTextFlaggedCount,
            recentResponses,
            recentTotal,
            surveyId: survey.id,
        })
    } catch (error) {
        console.error('[Admin Survey] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// ── DELETE: Remove a flagged free-text response ──
export async function DELETE(req: Request) {
    const session = await getUserSession()
    if (!session?.userId || !isAdmin(session.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { id } = await req.json()
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

        // Clear the free text (don't delete the whole response — keep category data)
        await prisma.surveyResponse.update({
            where: { id },
            data: { freeText: null, flagged: false },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Admin Survey DELETE] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// ── PATCH: Toggle flagged status on a response ──
export async function PATCH(req: Request) {
    const session = await getUserSession()
    if (!session?.userId || !isAdmin(session.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { id, flagged } = await req.json()
        if (!id || typeof flagged !== 'boolean') {
            return NextResponse.json({ error: 'Missing id or flagged' }, { status: 400 })
        }

        await prisma.surveyResponse.update({
            where: { id },
            data: { flagged },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Admin Survey PATCH] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

function maskEmail(email: string): string {
    const [local, domain] = email.split('@')
    if (!domain) return '***'
    const masked = local.charAt(0) + '***'
    return `${masked}@${domain}`
}
