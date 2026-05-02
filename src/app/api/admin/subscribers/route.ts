import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

// ── Bot Detection Scoring ─────────────────────────────────────────────────────
// Each signal adds to a 0-100 bot risk score.
// Score >= 70 = high risk, 40-69 = medium, <40 = low
const DISPOSABLE_DOMAINS = new Set([
    'emailax.pro', 'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com',
    'yopmail.com', 'trashmail.com', 'fakeinbox.com', 'sharklasers.com', 'dispostable.com',
    'mailnesia.com', 'tempail.com', 'temp-mail.org', 'mohmal.com', 'emailondeck.com',
    'getnada.com', '10minutemail.com', 'minutemail.com', 'maildrop.cc', 'mailcatch.com',
    'discard.email', 'tempr.email', 'temp-mail.io', 'guerrillamailblock.com', 'grr.la',
])

function calcBotScore(
    sub: { email: string; name: string | null; country: string | null },
    hasOpened: boolean,
    signupVelocity: number, // how many subs from same country in same hour
): number {
    let score = 0
    if (!sub.name) score += 15
    if (!hasOpened) score += 30
    // High-volume countries with no platform relevance (adjust as needed)
    const suspectCountries = new Set(['RU', 'CN', 'IN', 'BR', 'VN', 'ID', 'PK', 'BD', 'NG'])
    if (sub.country && suspectCountries.has(sub.country)) score += 20
    if (signupVelocity >= 10) score += 20 // 10+ signups from same country in same hour
    else if (signupVelocity >= 5) score += 10
    const domain = sub.email.split('@')[1]?.toLowerCase()
    if (domain && DISPOSABLE_DOMAINS.has(domain)) score += 25
    return Math.min(score, 100)
}

export async function GET(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { searchParams } = new URL(req.url)
    const page    = Math.max(1, parseInt(searchParams.get('page')  || '1'))
    const limit   = Math.min(100, parseInt(searchParams.get('limit') || '50'))
    const search  = searchParams.get('search')?.trim() || ''
    const status  = searchParams.get('status') || 'all'   // 'all' | 'active' | 'inactive' | 'failed' | 'converted' | 'subscriber_only' | 'verified' | 'unverified' | 'new_month'
    const sort    = searchParams.get('sort')   || 'newest' // 'newest' | 'oldest' | 'name' | 'fails'
    const format  = searchParams.get('format') || 'json'  // 'json' | 'csv'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any

    const where: Record<string, unknown> = {}
    if (search) {
        where.OR = [
            { email: { contains: search, mode: 'insensitive' } },
            { name:  { contains: search, mode: 'insensitive' } },
        ]
    }
    if (status === 'active')   where.active = true
    if (status === 'inactive') where.active = false

    const orderBy = sort === 'oldest' ? { subscribedAt: 'asc' }
                  : sort === 'name'   ? { email: 'asc' }
                  : sort === 'fails'  ? { subscribedAt: 'desc' }  // sort by newest (fail count is enriched, not in DB)
                  : { subscribedAt: 'desc' }

    // Count failed sends per subscriber email (from EmailLog)
    const failedEmailCounts = await db.emailLog.groupBy({
        by: ['to'],
        where: { success: false },
        _count: { id: true },
    }) as { to: string; _count: { id: number } }[]
    const failedMap = new Map(failedEmailCounts.map((f: { to: string; _count: { id: number } }) => [f.to, f._count.id]))

    // Collect emails with failures for the 'failed' filter
    const failedEmails = failedEmailCounts.map((f: { to: string }) => f.to)

    // Apply 'failed' status filter — subscribers whose email appears in failed EmailLog entries
    if (status === 'failed' && failedEmails.length > 0) {
        where.email = { in: failedEmails }
    } else if (status === 'failed') {
        // No failed emails at all — return empty
        where.email = { in: [] }
    }

    // Survey status cross-reference
    const [surveyResponders, surveyQueuedEmails] = await Promise.all([
        db.surveyResponse.findMany({ select: { email: true } }),
        db.emailQueue.findMany({
            where: { type: 'survey_campaign', status: { in: ['sent', 'processing', 'pending'] } },
            select: { to: true },
        }),
    ])
    const surveyRespondedSet = new Set((surveyResponders as { email: string | null }[]).filter(r => r.email).map(r => r.email!.toLowerCase()))
    const surveySentSet = new Set((surveyQueuedEmails as { to: string }[]).map(r => r.to.toLowerCase()))
    // Merge: anyone who responded was also sent
    for (const e of surveyRespondedSet) surveySentSet.add(e)

    // Survey filters
    if (status === 'survey_sent') {
        const sentArr = [...surveySentSet]
        where.email = { in: sentArr.length > 0 ? sentArr : ['__none__'], mode: 'insensitive' }
    } else if (status === 'survey_responded') {
        const respArr = [...surveyRespondedSet]
        where.email = { in: respArr.length > 0 ? respArr : ['__none__'], mode: 'insensitive' }
    } else if (status === 'survey_not_sent') {
        // All subscribers NOT in the sent set
        const allSubsForFilter = await db.subscriber.findMany({ select: { email: true } }) as { email: string }[]
        const notSent = allSubsForFilter.filter((s: { email: string }) => !surveySentSet.has(s.email.toLowerCase())).map((s: { email: string }) => s.email)
        where.email = { in: notSent.length > 0 ? notSent : ['__none__'] }
    }

    // Converted filter: subscribers whose email matches a registered User
    // subscriber_only: subscribers whose email does NOT match any User
    if (status === 'converted' || status === 'subscriber_only' || status === 'verified' || status === 'unverified') {
        const allUsers = await db.user.findMany({
            select: { email: true, emailVerified: true },
        }) as { email: string; emailVerified: boolean }[]
        const userEmailMap = new Map(allUsers.map((u: { email: string; emailVerified: boolean }) => [u.email.toLowerCase(), u]))

        // Get all subscriber emails to cross-reference
        const allSubs = await db.subscriber.findMany({ select: { email: true } }) as { email: string }[]

        if (status === 'converted') {
            const convertedEmails = allSubs
                .filter((s: { email: string }) => userEmailMap.has(s.email.toLowerCase()))
                .map((s: { email: string }) => s.email)
            where.email = { in: convertedEmails.length > 0 ? convertedEmails : ['__none__'] }
        } else if (status === 'subscriber_only') {
            const subOnlyEmails = allSubs
                .filter((s: { email: string }) => !userEmailMap.has(s.email.toLowerCase()))
                .map((s: { email: string }) => s.email)
            where.email = { in: subOnlyEmails.length > 0 ? subOnlyEmails : ['__none__'] }
        } else if (status === 'verified') {
            const verifiedEmails = allSubs
                .filter((s: { email: string }) => {
                    const u = userEmailMap.get(s.email.toLowerCase())
                    return u && u.emailVerified === true
                })
                .map((s: { email: string }) => s.email)
            where.email = { in: verifiedEmails.length > 0 ? verifiedEmails : ['__none__'] }
        } else if (status === 'unverified') {
            const unverifiedEmails = allSubs
                .filter((s: { email: string }) => {
                    const u = userEmailMap.get(s.email.toLowerCase())
                    return !u || u.emailVerified !== true
                })
                .map((s: { email: string }) => s.email)
            where.email = { in: unverifiedEmails.length > 0 ? unverifiedEmails : ['__none__'] }
        }
    }

    // New this month: subscribed in the current calendar month
    // Suspect bot filter — server-side is approximated by country + no name
    // Real score is calculated post-query via enrichment
    if (status === 'suspect_bot') {
        // Approximate: subscribers from high-volume suspect countries with no name
        const suspectCountries = ['RU', 'CN', 'VN', 'BD', 'PK']
        where.country = { in: suspectCountries }
        where.name = null
    }

    if (status === 'new_month') {
        const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
        where.subscribedAt = { gte: monthStart }
    }

    const [total, active, inactive] = await Promise.all([
        db.subscriber.count(),
        db.subscriber.count({ where: { active: true } }),
        db.subscriber.count({ where: { active: false } }),
    ])
    const failedCount = await db.subscriber.count({
        where: { email: { in: failedEmails.length > 0 ? failedEmails : ['__none__'] } },
    })

    // CSV export — return all matching rows, no pagination
    if (format === 'csv') {
        const all = await db.subscriber.findMany({
            where,
            orderBy,
            select: { email: true, name: true, active: true, subscribedAt: true },
        })
        const header = 'Email,Name,Status,Failed Sends,Subscribed At'
        const rows = all.map((s: { email: string; name: string | null; active: boolean; subscribedAt: Date }) =>
            `"${s.email}","${s.name || ''}","${s.active ? 'active' : 'inactive'}","${failedMap.get(s.email) || 0}","${new Date(s.subscribedAt).toISOString()}"`
        )
        const csv = [header, ...rows].join('\n')
        return new Response(csv, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="subscribers-${new Date().toISOString().slice(0,10)}.csv"`,
            },
        })
    }

    const subscribers = await db.subscriber.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, email: true, name: true, active: true, subscribedAt: true, country: true },
    })

    // Look up matching Users by email for conversion tracking
    const subEmails = subscribers.map((s: { email: string }) => s.email)
    const matchedUsers = subEmails.length > 0
        ? await db.user.findMany({
            where: { email: { in: subEmails, mode: 'insensitive' } },
            select: { id: true, email: true, preferredLanguage: true, emailVerified: true, createdAt: true },
        }) as { id: string; email: string; preferredLanguage: string | null; emailVerified: boolean; createdAt: Date }[]
        : []
    const userMap = new Map(matchedUsers.map((u: { id: string; email: string; preferredLanguage: string | null; emailVerified: boolean; createdAt: Date }) =>
        [u.email.toLowerCase(), u]
    ))

    // ── Bot detection: open tracking + signup velocity ──────────────────
    const subEmails2 = subscribers.map((s: { email: string }) => s.email)
    const openedRecords = subEmails2.length > 0
        ? await db.emailLog.findMany({
            where: { to: { in: subEmails2 }, openedAt: { not: null } },
            select: { to: true },
            distinct: ['to'],
        }) as { to: string }[]
        : []
    const openedSet = new Set(openedRecords.map((r: { to: string }) => r.to.toLowerCase()))

    // Signup velocity: count subscribers from same country within ±1 hour
    const countryGroups = await db.subscriber.groupBy({
        by: ['country'],
        _count: { country: true },
    }) as { country: string | null; _count: { country: number } }[]
    const countryCountMap = new Map(countryGroups.map((g: { country: string | null; _count: { country: number } }) => [g.country, g._count.country]))

    // Enrich each subscriber with conversion data + bot score
    const enriched = subscribers.map((s: { id: string; email: string; name: string | null; active: boolean; subscribedAt: Date; country: string | null }) => {
        const matchedUser = userMap.get(s.email.toLowerCase()) || null
        const emailLower = s.email.toLowerCase()
        const hasOpened = openedSet.has(emailLower)
        const velocity = countryCountMap.get(s.country) || 0
        const botScore = calcBotScore(s, hasOpened, velocity)
        return {
            ...s,
            failedSends: failedMap.get(s.email) || 0,
            // Conversion fields
            converted: !!matchedUser,
            userId: matchedUser?.id || null,
            convertedAt: matchedUser?.createdAt || null,
            emailVerified: matchedUser?.emailVerified ?? null,
            language: matchedUser?.preferredLanguage || (matchedUser ? 'en' : null),
            // Survey fields
            surveySent: surveySentSet.has(emailLower),
            surveyResponded: surveyRespondedSet.has(emailLower),
            // Bot detection
            botScore,
            hasOpened,
        }
    })

    // ── Conversion reporting stats ────────────────────────────────────────
    const totalUsers = await db.user.count()
    const allSubEmails = await db.subscriber.findMany({ select: { email: true } }) as { email: string }[]
    const allUserEmails = await db.user.findMany({ select: { email: true } }) as { email: string }[]
    const subEmailSet = new Set(allSubEmails.map((s: { email: string }) => s.email.toLowerCase()))
    const userEmailSet = new Set(allUserEmails.map((u: { email: string }) => u.email.toLowerCase()))
    const overlap = [...subEmailSet].filter(e => userEmailSet.has(e)).length
    const subscriberOnly = subEmailSet.size - overlap
    const userOnly = userEmailSet.size - overlap
    // New conversions this month: users created this month whose email is also a subscriber
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const recentUsers = await db.user.findMany({
        where: { createdAt: { gte: monthStart } },
        select: { email: true },
    }) as { email: string }[]
    const newConversions = recentUsers.filter((u: { email: string }) => subEmailSet.has(u.email.toLowerCase())).length
    const conversionRate = subEmailSet.size > 0 ? Math.round((overlap / subEmailSet.size) * 100) : 0

    // Bot stats: count high-risk subscribers across entire list
    const allSubsForBot = await db.subscriber.findMany({
        select: { email: true, name: true, country: true },
    }) as { email: string; name: string | null; country: string | null }[]
    const allOpenedRecords = await db.emailLog.findMany({
        where: { openedAt: { not: null } },
        select: { to: true },
        distinct: ['to'],
    }) as { to: true }[]
    const allOpenedSet = new Set((allOpenedRecords as unknown as { to: string }[]).map(r => r.to.toLowerCase()))
    let highRiskCount = 0; let medRiskCount = 0
    for (const s of allSubsForBot) {
        const bScore = calcBotScore(s, allOpenedSet.has(s.email.toLowerCase()), countryCountMap.get(s.country) || 0)
        if (bScore >= 70) highRiskCount++
        else if (bScore >= 40) medRiskCount++
    }

    // Country breakdown for admin panel
    const countryBreakdown = countryGroups
        .filter((g: { country: string | null; _count: { country: number } }) => g.country)
        .sort((a: { _count: { country: number } }, b: { _count: { country: number } }) => b._count.country - a._count.country)
        .slice(0, 10)
        .map((g: { country: string | null; _count: { country: number } }) => ({ country: g.country, count: g._count.country }))

    return NextResponse.json({
        subscribers: enriched,
        stats: { total, active, inactive, failed: failedCount, surveySent: surveySentSet.size, surveyResponded: surveyRespondedSet.size },
        botStats: { highRisk: highRiskCount, medRisk: medRiskCount, countryBreakdown },
        conversion: {
            totalSubscribers: total,
            totalUsers,
            converted: overlap,
            conversionRate,
            subscriberOnly,
            userOnly,
            overlap,
            newConversionsThisMonth: newConversions,
        },
        pagination: {
            page, limit, total: (await db.subscriber.count({ where })),
            totalPages: Math.ceil((await db.subscriber.count({ where })) / limit),
        },
    })
}

export async function PATCH(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { ids, active }: { ids: string[]; active: boolean } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (prisma as any).subscriber.updateMany({ where: { id: { in: ids } }, data: { active } })
    return NextResponse.json({ updated: result.count })
}

export async function DELETE(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { ids }: { ids: string[] } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (prisma as any).subscriber.deleteMany({ where: { id: { in: ids } } })
    return NextResponse.json({ deleted: result.count })
}
