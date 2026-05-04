/**
 * Admin Subscriber Purge API
 * ---------------------------------------------------------------------------
 * GET  /api/admin/subscribers/purge  → preview count of purgeable subscribers
 * POST /api/admin/subscribers/purge  → execute purge, return deleted count
 *
 * "Purgeable" = subscribers whose email is actively suppressed in
 * the EmailSuppression table (hard_bounce, complaint, or manual suppress).
 * These addresses will never receive email again, so they inflate list
 * counts and add noise to the admin dashboard.
 *
 * Protected by requireAdmin() from @/lib/auth.
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { purgeAllSuppressedSubscribers } from '@/lib/suppression'
import { logger } from '@/lib/logger'

// ── GET: Preview purgeable count ───────────────────────────────────────────

export async function GET() {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        // Get all actively suppressed emails (not lifted)
        const suppressed = await prisma.emailSuppression.findMany({
            where: { removedAt: null },
            select: { email: true, reason: true },
        })

        if (suppressed.length === 0) {
            return NextResponse.json({
                purgeableCount: 0,
                suppressedCount: 0,
                breakdown: {},
            })
        }

        const emails = suppressed.map(s => s.email)

        // Count how many subscribers match suppressed emails
        const purgeableCount = await prisma.subscriber.count({
            where: { email: { in: emails } },
        })

        // Count expired unconfirmed subscribers
        const expiredCutoff = new Date(Date.now() - 72 * 60 * 60 * 1000)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const expiredUnconfirmedCount = await (prisma as any).subscriber.count({
            where: {
                active: false,
                confirmedAt: null,
                tokenExpiresAt: { not: null, lte: expiredCutoff },
            },
        })

        // Breakdown by suppression reason
        const breakdown: Record<string, number> = {}
        for (const s of suppressed) {
            breakdown[s.reason] = (breakdown[s.reason] || 0) + 1
        }

        return NextResponse.json({
            purgeableCount,
            suppressedCount: suppressed.length,
            breakdown,
            expiredUnconfirmedCount,
        })
    } catch (err) {
        logger.error('admin/purge', 'Failed to preview purge', { error: err as Error })
        return NextResponse.json({ error: 'Failed to load purge preview' }, { status: 500 })
    }
}

// ── POST: Execute purge ────────────────────────────────────────────────────

export async function POST() {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const deleted = await purgeAllSuppressedSubscribers()

        // Also purge expired unconfirmed subscribers
        const expiredCutoff = new Date(Date.now() - 72 * 60 * 60 * 1000)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const unconfirmedResult = await (prisma as any).subscriber.deleteMany({
            where: {
                active: false,
                confirmedAt: null,
                tokenExpiresAt: { not: null, lte: expiredCutoff },
            },
        })
        const unconfirmedDeleted = unconfirmedResult.count

        logger.info('admin/purge', `Purged ${deleted} suppressed + ${unconfirmedDeleted} expired unconfirmed subscribers`)

        const totalDeleted = deleted + unconfirmedDeleted
        return NextResponse.json({
            success: true,
            deleted: totalDeleted,
            suppressedDeleted: deleted,
            unconfirmedDeleted,
            message: totalDeleted > 0
                ? `Permanently removed ${deleted} suppressed + ${unconfirmedDeleted} expired unconfirmed subscriber${totalDeleted !== 1 ? 's' : ''}`
                : 'No subscribers to purge',
        })
    } catch (err) {
        logger.error('admin/purge', 'Purge failed', { error: err as Error })
        return NextResponse.json({ error: 'Purge failed' }, { status: 500 })
    }
}
