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

import { getBotFlags, BOT_EMAIL_PATTERN } from '@/lib/botScore'

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

    // Fetch subscribers before deletion so we can write the audit log
    const toDelete = await db.subscriber.findMany({
        where: { id: { in: ids } },
        select: { id: true, email: true, botScore: true },
    }) as { id: string; email: string; botScore: number }[]

    const result = await db.subscriber.deleteMany({ where: { id: { in: ids } } })

    // ── Audit log — write to DeletedSubscriberLog (reason: admin_panel) ──────
    // Mirrors the cron's auto_cron entries. Gives admins a recoverable audit trail.
    if (toDelete.length > 0) {
        await db.deletedSubscriberLog.createMany({
            data: toDelete.map((s: { email: string; botScore: number }) => ({
                email: s.email,
                botScore: s.botScore,
                reason: 'admin_panel',
                deletedAt: new Date(),
            })),
        })
    }

    return NextResponse.json({ deleted: result.count })
}
