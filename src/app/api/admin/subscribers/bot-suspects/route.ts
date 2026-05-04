/**
 * GET  /api/admin/subscribers/bot-suspects
 *   Returns paginated subscribers with botScore >= threshold, with human-readable flags.
 *
 * DELETE /api/admin/subscribers/bot-suspects
 *   Body: { ids: string[], dryRun?: boolean }
 *   dryRun=true  → returns count without deleting
 *   dryRun=false → permanently deletes selected subscribers
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

const DISPOSABLE_DOMAINS = new Set([
    'emailax.pro', 'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com',
    'yopmail.com', 'trashmail.com', 'fakeinbox.com', 'sharklasers.com', 'dispostable.com',
    'mailnesia.com', 'tempail.com', 'temp-mail.org', 'mohmal.com', 'emailondeck.com',
    'getnada.com', '10minutemail.com', 'minutemail.com', 'maildrop.cc', 'mailcatch.com',
    'discard.email', 'tempr.email', 'temp-mail.io', 'guerrillamailblock.com', 'grr.la',
])
const SUSPECT_COUNTRIES = new Set(['RU', 'CN', 'VN', 'BD', 'PK', 'IN', 'BR', 'ID', 'NG'])
const BOT_EMAIL_PATTERN = /^[a-z]{5,}\d{5,}@/i

function getBotFlags(sub: {
    email: string
    name: string | null
    country: string | null
    botScore: number
    hasOpened: boolean
}): string[] {
    const flags: string[] = []
    const domain = sub.email.split('@')[1]?.toLowerCase()
    if (domain && DISPOSABLE_DOMAINS.has(domain)) flags.push('Disposable domain')
    if (!sub.name) flags.push('No name provided')
    if (sub.country && SUSPECT_COUNTRIES.has(sub.country)) flags.push(`High-risk country (${sub.country})`)
    if (!sub.hasOpened) flags.push('Never opened any email')
    if (BOT_EMAIL_PATTERN.test(sub.email)) flags.push('Bot-pattern email address')
    if (sub.botScore >= 70) flags.push(`High bot score (${sub.botScore}/100)`)
    else if (sub.botScore >= 40) flags.push(`Medium bot score (${sub.botScore}/100)`)
    return flags
}

export async function GET(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { searchParams } = new URL(req.url)
    const threshold = parseInt(searchParams.get('threshold') || '40')
    const page  = Math.max(1, parseInt(searchParams.get('page')  || '1'))
    const limit = Math.min(200, parseInt(searchParams.get('limit') || '100'))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any

    // Get all suspects above threshold (botScore stored on subscriber)
    const [suspects, total] = await Promise.all([
        db.subscriber.findMany({
            where: { botScore: { gte: threshold } },
            orderBy: { botScore: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            select: { id: true, email: true, name: true, country: true, subscribedAt: true, botScore: true, active: true },
        }),
        db.subscriber.count({ where: { botScore: { gte: threshold } } }),
    ])

    // Enrich with hasOpened from email logs
    const emails = suspects.map((s: { email: string }) => s.email)
    const openedRecords = emails.length > 0
        ? await db.emailLog.findMany({
            where: { to: { in: emails }, openedAt: { not: null } },
            select: { to: true },
            distinct: ['to'],
        })
        : []
    const openedSet = new Set((openedRecords as { to: string }[]).map(r => r.to.toLowerCase()))

    const enriched = suspects.map((s: { id: string; email: string; name: string | null; country: string | null; subscribedAt: Date; botScore: number; active: boolean }) => ({
        ...s,
        hasOpened: openedSet.has(s.email.toLowerCase()),
        flags: getBotFlags({ ...s, hasOpened: openedSet.has(s.email.toLowerCase()) }),
    }))

    return NextResponse.json({
        suspects: enriched,
        total,
        page,
        totalPages: Math.ceil(total / limit),
    })
}

export async function DELETE(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { ids, dryRun = false }: { ids: string[]; dryRun?: boolean } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any

    if (dryRun) {
        const count = await db.subscriber.count({ where: { id: { in: ids } } })
        return NextResponse.json({ dryRun: true, count })
    }

    const result = await db.subscriber.deleteMany({ where: { id: { in: ids } } })
    return NextResponse.json({ deleted: result.count })
}
