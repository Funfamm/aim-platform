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
        const ftFilter = url.searchParams.get('ftFilter') || 'all'
        const ftLimit = 20
        const rrLimit = 50

        const survey = await prisma.survey.findFirst({
            where: { active: true },
            orderBy: { createdAt: 'desc' },
        })

        if (!survey) {
            return NextResponse.json({ empty: true, surveyId: null })
        }

        const surveyId = survey.id

        // ── Fetch all responses for in-memory analytics ──
        const allResponses = await prisma.surveyResponse.findMany({
            where: { surveyId },
            select: {
                id: true, selections: true, freeText: true, country: true,
                createdAt: true, converted: true, flagged: true, email: true,
            },
        })

        const totalResponses = allResponses.length
        const now = new Date()
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

        // ── TOP LEVEL METRICS ──
        const responsesLast24h = allResponses.filter(r => r.createdAt >= oneDayAgo).length
        const responsesThisWeek = allResponses.filter(r => r.createdAt >= oneWeekAgo).length
        const convertedCount = allResponses.filter(r => r.converted).length
        const convertedPercentage = totalResponses > 0 ? round1(convertedCount / totalResponses * 100) : 0
        const openTextCount = allResponses.filter(r => r.freeText && r.freeText.trim()).length
        const countriesReached = new Set(allResponses.map(r => r.country).filter(Boolean)).size

        // ── CATEGORY BREAKDOWN ──
        const categoryCounts: Record<string, number> = {}
        for (const r of allResponses) {
            for (const sel of r.selections) {
                categoryCounts[sel] = (categoryCounts[sel] || 0) + 1
            }
        }
        const categoryBreakdown = Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
            key, label,
            count: categoryCounts[key] || 0,
            percentage: totalResponses > 0 ? round1((categoryCounts[key] || 0) / totalResponses * 100) : 0,
        })).sort((a, b) => b.count - a.count)

        // Most popular combination
        const comboCounts: Record<string, number> = {}
        for (const r of allResponses) {
            const key = [...r.selections].sort().join('|')
            comboCounts[key] = (comboCounts[key] || 0) + 1
        }
        const topComboEntry = Object.entries(comboCounts).sort((a, b) => b[1] - a[1])[0]
        const mostPopularCombination = topComboEntry
            ? { selections: topComboEntry[0].split('|'), count: topComboEntry[1] }
            : { selections: [], count: 0 }

        // Selection distribution
        const singleCount = allResponses.filter(r => r.selections.length === 1).length
        const multiCount = allResponses.filter(r => r.selections.length >= 2 && r.selections.length <= 6 && !r.selections.includes('all')).length
        const allSelectedCount = allResponses.filter(r => r.selections.includes('all')).length
        const singleSelectionRate = totalResponses > 0 ? round1(singleCount / totalResponses * 100) : 0
        const multiSelectionRate = totalResponses > 0 ? round1(multiCount / totalResponses * 100) : 0
        const allSelectedRate = totalResponses > 0 ? round1(allSelectedCount / totalResponses * 100) : 0

        const totalSelections = allResponses.reduce((sum, r) => sum + r.selections.length, 0)
        const avgSelectionsPerResponse = totalResponses > 0 ? round1(totalSelections / totalResponses) : 0
        const openTextRate = totalResponses > 0 ? round1(openTextCount / totalResponses * 100) : 0

        // ── GEOGRAPHIC STATS ──
        const countryCounts: Record<string, number> = {}
        for (const r of allResponses) {
            if (r.country) countryCounts[r.country] = (countryCounts[r.country] || 0) + 1
        }
        const topCountries = Object.entries(countryCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([country, count]) => ({
                country, count,
                percentage: totalResponses > 0 ? round1(count / totalResponses * 100) : 0,
            }))

        // Top genre by country
        const countryGenreMap: Record<string, Record<string, number>> = {}
        for (const r of allResponses) {
            if (!r.country) continue
            if (!countryGenreMap[r.country]) countryGenreMap[r.country] = {}
            for (const sel of r.selections) {
                countryGenreMap[r.country][sel] = (countryGenreMap[r.country][sel] || 0) + 1
            }
        }
        const genreByCountry = Object.entries(countryCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([country]) => {
                const genres = countryGenreMap[country] || {}
                const top = Object.entries(genres).sort((a, b) => b[1] - a[1])[0]
                return {
                    country,
                    topGenre: top ? (CATEGORY_LABELS[top[0]] || top[0]) : '—',
                    count: top ? top[1] : 0,
                }
            })

        // ── CONVERSION FUNNEL ──
        const emailsSent = await prisma.emailQueue.count({ where: { type: 'survey_campaign' } })
        const funnel = {
            emailsSent,
            surveyCompleted: totalResponses,
            clickedRegister: convertedCount,
            actuallyRegistered: convertedCount,
            openRate: emailsSent > 0 ? round1(totalResponses / emailsSent * 100) : null,
            completionRate: emailsSent > 0 ? round1(totalResponses / emailsSent * 100) : null,
            conversionRate: totalResponses > 0 ? round1(convertedCount / totalResponses * 100) : null,
        }

        // Genre conversion correlation
        const genreConversionCorrelation = Object.entries(CATEGORY_LABELS).map(([genre, label]) => {
            const withGenre = allResponses.filter(r => r.selections.includes(genre))
            const conversions = withGenre.filter(r => r.converted).length
            return {
                genre: label,
                totalSelections: withGenre.length,
                conversions,
                conversionRate: withGenre.length > 0 ? round1(conversions / withGenre.length * 100) : 0,
            }
        }).sort((a, b) => b.conversionRate - a.conversionRate)

        // Avg time to convert (hours)
        let avgTimeToConvert: number | null = null
        const convertedResponses = allResponses.filter(r => r.converted && r.email)
        if (convertedResponses.length > 0) {
            const emails = convertedResponses.map(r => r.email!.toLowerCase())
            const users = await prisma.user.findMany({
                where: { email: { in: emails } },
                select: { email: true, createdAt: true },
            })
            const userMap = new Map(users.map(u => [u.email.toLowerCase(), u.createdAt]))
            let totalHours = 0
            let matched = 0
            for (const r of convertedResponses) {
                const userCreated = userMap.get(r.email!.toLowerCase())
                if (userCreated) {
                    totalHours += Math.abs(userCreated.getTime() - r.createdAt.getTime()) / 3600000
                    matched++
                }
            }
            avgTimeToConvert = matched > 0 ? round1(totalHours / matched) : null
        }

        // ── TIME STATS ──
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        const dayMap: Record<string, number> = {}
        for (let d = new Date(thirtyDaysAgo); d <= now; d = new Date(d.getTime() + 86400000)) {
            dayMap[d.toISOString().slice(0, 10)] = 0
        }
        for (const r of allResponses) {
            const day = r.createdAt.toISOString().slice(0, 10)
            if (dayMap[day] !== undefined) dayMap[day]++
        }
        const responsesByDay = Object.entries(dayMap).map(([date, count]) => ({ date, count }))

        // Peak hours
        const hourCounts = Array.from({ length: 24 }, () => 0)
        for (const r of allResponses) {
            hourCounts[r.createdAt.getUTCHours()]++
        }
        const peakHours = hourCounts.map((count, hour) => ({ hour, count }))

        // Velocity
        const campaignSentLog = await prisma.emailLog.findFirst({
            where: { type: 'survey_campaign' },
            orderBy: { sentAt: 'asc' },
            select: { sentAt: true },
        })
        const campaignSentAt = campaignSentLog?.sentAt
        let velocityFirst24h = 0
        let velocityAfter24h = 0
        if (campaignSentAt) {
            const cutoff = new Date(campaignSentAt.getTime() + 24 * 60 * 60 * 1000)
            velocityFirst24h = allResponses.filter(r => r.createdAt < cutoff).length
            velocityAfter24h = allResponses.filter(r => r.createdAt >= cutoff).length
        }

        // ── MODERATION STATS ──
        const flaggedCount = allResponses.filter(r => r.flagged).length
        const flaggedByCountryMap: Record<string, number> = {}
        for (const r of allResponses) {
            if (r.flagged && r.country) flaggedByCountryMap[r.country] = (flaggedByCountryMap[r.country] || 0) + 1
        }
        const flaggedByCountry = Object.entries(flaggedByCountryMap)
            .sort((a, b) => b[1] - a[1])
            .map(([country, count]) => ({ country, count }))
        const cleanResponseRate = totalResponses > 0 ? round1((totalResponses - flaggedCount) / totalResponses * 100) : 100

        // ── PAGINATED: Free Text ──
        const ftWhere: Record<string, unknown> = { surveyId, freeText: { not: null } }
        if (ftFilter === 'flagged') ftWhere.flagged = true
        else if (ftFilter === 'clean') ftWhere.flagged = false
        else if (ftFilter === 'converted') ftWhere.converted = true

        const [freeTextTotal, freeTextFlaggedCount, freeTextConvertedCount, freeTextRows] = await Promise.all([
            prisma.surveyResponse.count({ where: { surveyId, freeText: { not: null } } }),
            prisma.surveyResponse.count({ where: { surveyId, freeText: { not: null }, flagged: true } }),
            prisma.surveyResponse.count({ where: { surveyId, freeText: { not: null }, converted: true } }),
            prisma.surveyResponse.findMany({
                where: ftWhere,
                orderBy: { createdAt: 'desc' },
                take: ftLimit,
                skip: (ftPage - 1) * ftLimit,
                select: { id: true, freeText: true, country: true, createdAt: true, flagged: true, converted: true },
            }),
        ])
        const freeTextResponses = freeTextRows.map(r => ({
            id: r.id, text: r.freeText!, country: r.country,
            createdAt: r.createdAt.toISOString(), flagged: r.flagged, converted: r.converted,
        }))

        // ── PAGINATED: Recent responses ──
        const recentTotal = totalResponses
        const recentRows = await prisma.surveyResponse.findMany({
            where: { surveyId },
            orderBy: { createdAt: 'desc' },
            take: rrLimit,
            skip: (rrPage - 1) * rrLimit,
            select: { id: true, email: true, selections: true, country: true, createdAt: true, flagged: true, converted: true },
        })
        const recentResponses = recentRows.map(r => ({
            id: r.id,
            email: r.email ? maskEmail(r.email) : null,
            selections: r.selections,
            country: r.country,
            createdAt: r.createdAt.toISOString(),
            converted: r.converted,
            flagged: r.flagged,
        }))

        // ── DELIVERY STATS ──
        const [deliverySent, deliveryPending, deliveryProcessing, deliveryFailed, deliveryCancelled] = await Promise.all([
            prisma.emailQueue.count({ where: { type: 'survey_campaign', status: 'sent' } }),
            prisma.emailQueue.count({ where: { type: 'survey_campaign', status: 'pending' } }),
            prisma.emailQueue.count({ where: { type: 'survey_campaign', status: 'processing' } }),
            prisma.emailQueue.count({ where: { type: 'survey_campaign', status: 'failed' } }),
            prisma.emailQueue.count({ where: { type: 'survey_campaign', status: 'cancelled' } }),
        ])
        const deliveryTotal = deliverySent + deliveryPending + deliveryProcessing + deliveryFailed + deliveryCancelled
        const deliveryLog = await prisma.emailLog.findMany({
            where: { type: 'survey_campaign' },
            orderBy: { sentAt: 'desc' },
            take: 10,
            select: { to: true, success: true, transport: true, sentAt: true, error: true },
        })

        return NextResponse.json({
            totalResponses, responsesLast24h, responsesThisWeek,
            convertedCount, convertedPercentage, openTextCount, countriesReached,
            categoryBreakdown, mostPopularCombination,
            singleSelectionRate, multiSelectionRate, allSelectedRate,
            avgSelectionsPerResponse, openTextRate,
            topCountries, genreByCountry,
            funnel, genreConversionCorrelation, avgTimeToConvert,
            responsesByDay, peakHours,
            velocityFirst24h, velocityAfter24h,
            flaggedCount, flaggedByCountry, cleanResponseRate,
            freeTextResponses, freeTextTotal, freeTextFlaggedCount, freeTextConvertedCount,
            recentResponses, recentTotal,
            surveyId,
            delivery: {
                total: deliveryTotal, sent: deliverySent, pending: deliveryPending,
                processing: deliveryProcessing, failed: deliveryFailed, cancelled: deliveryCancelled,
                log: deliveryLog.map(l => ({
                    to: maskEmail(l.to), success: l.success, transport: l.transport,
                    sentAt: l.sentAt?.toISOString() || null,
                    error: l.error ? l.error.slice(0, 120) : null,
                })),
            },
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
        await prisma.surveyResponse.update({ where: { id }, data: { flagged } })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Admin Survey PATCH] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

function maskEmail(email: string): string {
    const [local, domain] = email.split('@')
    if (!domain) return '***'
    return `${local.charAt(0)}***@${domain}`
}

function round1(n: number): number {
    return Math.round(n * 10) / 10
}
