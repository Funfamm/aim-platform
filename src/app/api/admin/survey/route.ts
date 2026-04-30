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

export async function GET() {
    const session = await getUserSession()
    if (!session?.userId || !isAdmin(session.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
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
                categoryBreakdown: [],
                freeTextResponses: [],
                recentResponses: [],
            })
        }

        const allResponses = await prisma.surveyResponse.findMany({
            where: { surveyId: survey.id },
            orderBy: { createdAt: 'desc' },
        })

        const totalResponses = allResponses.length
        const now = new Date()
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const responsesLast24h = allResponses.filter(r => r.createdAt >= oneDayAgo).length
        const convertedCount = allResponses.filter(r => r.converted).length
        const conversionRate = totalResponses > 0 ? Math.round((convertedCount / totalResponses) * 1000) / 10 : 0

        // Category breakdown
        const categoryCounts: Record<string, number> = {}
        for (const r of allResponses) {
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

        // Free text responses (latest 100)
        const freeTextResponses = allResponses
            .filter(r => r.freeText && r.freeText.trim())
            .slice(0, 100)
            .map(r => ({
                text: r.freeText!,
                createdAt: r.createdAt.toISOString(),
                country: r.country,
            }))

        // Recent responses (latest 50) with masked email
        const recentResponses = allResponses.slice(0, 50).map(r => ({
            email: r.email ? maskEmail(r.email) : null,
            selections: r.selections,
            country: r.country,
            createdAt: r.createdAt.toISOString(),
        }))

        return NextResponse.json({
            totalResponses,
            responsesLast24h,
            conversionRate,
            convertedCount,
            categoryBreakdown,
            freeTextResponses,
            recentResponses,
            surveyId: survey.id,
        })
    } catch (error) {
        console.error('[Admin Survey] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

function maskEmail(email: string): string {
    const [local, domain] = email.split('@')
    if (!domain) return '***'
    const masked = local.charAt(0) + '***'
    return `${masked}@${domain}`
}
