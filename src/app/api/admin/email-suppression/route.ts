import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { liftSuppression, manuallySuppress, purgeAllSuppressedSubscribers } from '@/lib/suppression'
import { logAdminAction } from '@/lib/audit-log'

/**
 * GET /api/admin/email-suppression
 * Returns the suppression list with filters + stats.
 *
 * Query params:
 *   - reason: filter by reason (hard_bounce, soft_bounce, complaint, manual, unsubscribe)
 *   - search: search by email substring
 *   - page: pagination (default 1)
 *   - limit: per page (default 50, max 200)
 *   - active: 'true' for active suppressions only, 'false' for lifted
 */
export async function GET(request: Request) {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(request.url)
    const reason = url.searchParams.get('reason') || undefined
    const search = url.searchParams.get('search') || undefined
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)))
    const activeOnly = url.searchParams.get('active') !== 'false'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    if (activeOnly) {
        where.removedAt = null
    }
    if (reason) {
        where.reason = reason
    }
    if (search) {
        where.email = { contains: search.toLowerCase(), mode: 'insensitive' }
    }

    const [records, total, stats] = await Promise.all([
        prisma.emailSuppression.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.emailSuppression.count({ where }),
        // Stats by reason (active suppressions only)
        prisma.emailSuppression.groupBy({
            by: ['reason'],
            where: { removedAt: null },
            _count: true,
        }),
    ])

    const statsByReason: Record<string, number> = {}
    for (const s of stats) {
        statsByReason[s.reason] = s._count
    }

    return NextResponse.json({
        records,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        stats: statsByReason,
        totalActive: Object.values(statsByReason).reduce((a, b) => a + b, 0),
    })
}

/**
 * POST /api/admin/email-suppression
 * Admin actions: add, remove, purge.
 *
 * Body:
 *   { action: 'add', email: string, reason?: string }
 *   { action: 'remove', email: string }
 *   { action: 'purge_subscribers' }
 *   { action: 'delete', email: string }  — permanently delete suppression record
 */
export async function POST(request: Request) {
    let session
    try { session = await requireAdmin() } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { action, email, reason } = body

    switch (action) {
        case 'add': {
            if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })
            const ok = await manuallySuppress(email, session.userId, reason || 'manual')
            logAdminAction({ actor: session.userId, action: 'SUPPRESS_EMAIL', target: email })
            return NextResponse.json({ success: ok })
        }

        case 'remove': {
            if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })
            const ok = await liftSuppression(email, session.userId)
            logAdminAction({ actor: session.userId, action: 'LIFT_SUPPRESSION', target: email })
            return NextResponse.json({ success: ok })
        }

        case 'delete': {
            if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })
            const normalized = email.toLowerCase().trim()
            try {
                await prisma.emailSuppression.delete({ where: { email: normalized } })
                logAdminAction({ actor: session.userId, action: 'DELETE_SUPPRESSION', target: normalized })
                return NextResponse.json({ success: true })
            } catch {
                return NextResponse.json({ error: 'Not found' }, { status: 404 })
            }
        }

        case 'purge_subscribers': {
            const count = await purgeAllSuppressedSubscribers()
            logAdminAction({ actor: session.userId, action: 'PURGE_SUPPRESSED_SUBSCRIBERS', target: `${count} subscribers` })
            return NextResponse.json({ success: true, purged: count })
        }

        case 'purge_bots': {
            const threshold = typeof body.threshold === 'number' ? body.threshold : 70

            // ── Bot score is computed at runtime (no DB column) ──────────────
            const DISPOSABLE_DOMAINS = new Set([
                'emailax.pro', 'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com',
                'yopmail.com', 'trashmail.com', 'fakeinbox.com', 'sharklasers.com', 'dispostable.com',
                'mailnesia.com', 'tempail.com', 'temp-mail.org', 'mohmal.com', 'emailondeck.com',
                'getnada.com', '10minutemail.com', 'minutemail.com', 'maildrop.cc', 'mailcatch.com',
                'discard.email', 'tempr.email', 'temp-mail.io', 'guerrillamailblock.com', 'grr.la',
            ])
            const suspectCountries = new Set(['RU', 'CN', 'IN', 'BR', 'VN', 'ID', 'PK', 'BD', 'NG'])

            function calcBotScore(
                sub: { email: string; name: string | null; country: string | null },
                hasOpened: boolean,
                signupVelocity: number,
            ): number {
                let score = 0
                if (!sub.name) score += 15
                if (!hasOpened) score += 30
                if (sub.country && suspectCountries.has(sub.country)) score += 20
                if (signupVelocity >= 10) score += 20
                else if (signupVelocity >= 5) score += 10
                const domain = sub.email.split('@')[1]?.toLowerCase()
                if (domain && DISPOSABLE_DOMAINS.has(domain)) score += 25
                return Math.min(score, 100)
            }

            // Fetch all subscribers + engagement signals
            const allSubs = await prisma.subscriber.findMany({
                select: { email: true, name: true, country: true },
            })

            // Open tracking
            const openedRecords = await prisma.emailLog.findMany({
                where: { openedAt: { not: null } },
                select: { to: true },
                distinct: ['to'],
            })
            const openedSet = new Set(openedRecords.map(r => r.to.toLowerCase()))

            // Country velocity
            const countryGroups = await prisma.subscriber.groupBy({
                by: ['country'],
                _count: { country: true },
            })
            const countryCountMap = new Map(countryGroups.map(g => [g.country, g._count.country]))

            // Compute scores and find high-risk bots
            const botSubs = allSubs.filter(s => {
                const score = calcBotScore(s, openedSet.has(s.email.toLowerCase()), countryCountMap.get(s.country) || 0)
                return score >= threshold
            })

            if (botSubs.length === 0) {
                return NextResponse.json({ success: true, purged: 0 })
            }

            // ── Safety exclusions: protect real subscribers ──────────────────
            const botEmails = botSubs.map(s => s.email)

            // 1. Exclude anyone who has opened an email — real engagement
            const openerSet = openedSet // already computed above

            // 2. Exclude converted subscribers (registered users)
            const users = await prisma.user.findMany({
                where: { email: { in: botEmails, mode: 'insensitive' } },
                select: { email: true },
            })
            const userSet = new Set(users.map(u => u.email.toLowerCase()))

            // Only purge if NOT engaged and NOT a registered user
            const eligible = botSubs.filter(s =>
                !openerSet.has(s.email.toLowerCase()) &&
                !userSet.has(s.email.toLowerCase())
            )
            if (eligible.length === 0) {
                return NextResponse.json({ success: true, purged: 0, protected: botSubs.length, message: 'All high-risk subscribers have engagement signals — none purged.' })
            }

            const eligibleEmails = eligible.map(s => s.email)
            // Suppress each confirmed bot email
            await Promise.all(eligible.map(sub =>
                prisma.emailSuppression.upsert({
                    where: { email: sub.email },
                    create: {
                        email: sub.email,
                        reason: 'bot',
                        bounceType: 'permanent',
                        source: 'admin',
                        detail: `Auto-suppressed: bot score >= threshold ${threshold}`,
                    },
                    update: {
                        reason: 'bot',
                        bounceType: 'permanent',
                        source: 'admin',
                        detail: `Auto-suppressed: bot score >= threshold ${threshold}`,
                        removedAt: null,
                        removedBy: null,
                    },
                })
            ))
            // Permanently delete only the confirmed-bot subscriber rows
            const del = await prisma.subscriber.deleteMany({
                where: { email: { in: eligibleEmails } },
            })
            const protectedCount = botSubs.length - eligible.length
            logAdminAction({ actor: session.userId, action: 'PURGE_BOT_SUBSCRIBERS', target: `${del.count} bots (score >= ${threshold}, ${protectedCount} protected by engagement/conversion)` })
            return NextResponse.json({ success: true, purged: del.count, protected: protectedCount })
        }

        default:
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
}
