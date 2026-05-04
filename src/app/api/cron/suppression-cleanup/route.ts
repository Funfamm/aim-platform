/**
 * Suppression Cleanup Cron
 * ---------------------------------------------------------------------------
 * GET /api/cron/suppression-cleanup
 *
 * Triggered by Vercel Cron every hour.
 *
 * Tasks:
 *   1. Lift expired temp suppressions (soft_bounce 7-day expiry)
 *   2. Re-activate subscribers ONLY if they have zero remaining active suppressions
 *      (prevents reactivating an address with both an expired soft bounce AND an active hard bounce)
 *   3. Prune old EmailBounceEvent records (>30 days)
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
    // Verify cron secret to prevent unauthorized triggers
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    let expiredLifted = 0
    let subscribersReactivated = 0
    let bounceEventsPruned = 0
    let unconfirmedPurged = 0

    try {
        // ── 1. Find and lift expired temp suppressions ──────────────────────
        const expiredSuppressions = await prisma.emailSuppression.findMany({
            where: {
                removedAt: null,
                expiresAt: { not: null, lte: now },
            },
            select: { email: true, id: true },
        })

        if (expiredSuppressions.length > 0) {
            // Soft-delete all expired suppressions in one batch
            await prisma.emailSuppression.updateMany({
                where: {
                    id: { in: expiredSuppressions.map(s => s.id) },
                },
                data: {
                    removedAt: now,
                    removedBy: 'system:cleanup-cron',
                },
            })
            expiredLifted = expiredSuppressions.length

            // ── 2. Re-activate subscribers ONLY if they have zero remaining active suppressions ──
            // This prevents reactivating an address that has both an expired soft bounce
            // AND a still-active hard bounce or complaint
            for (const { email } of expiredSuppressions) {
                const remainingActive = await prisma.emailSuppression.count({
                    where: {
                        email,
                        removedAt: null,
                        OR: [
                            { expiresAt: null },           // Permanent suppressions (hard_bounce, complaint, etc.)
                            { expiresAt: { gt: now } },    // Not-yet-expired temp suppressions
                        ],
                    },
                })

                if (remainingActive === 0) {
                    await prisma.subscriber.updateMany({
                        where: { email },
                        data: {
                            active: true,
                            suppressedAt: null,
                            suppressReason: null,
                        },
                    })
                    subscribersReactivated++
                }
            }
        }

        // ── 3. Prune old EmailBounceEvent records (>30 days) ────────────────
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pruneResult = await (prisma as any).emailBounceEvent.deleteMany({
            where: { occurredAt: { lt: thirtyDaysAgo } },
        })
        bounceEventsPruned = pruneResult.count

        // ── 4. Purge expired unconfirmed subscribers ─────────────────────────
        // These are rows where the user never clicked the confirmation link and
        // the 72-hour window has passed. Safe to delete — no confirmedAt was set.
        const expiredUnconfirmedCutoff = new Date(Date.now() - 72 * 60 * 60 * 1000)
        const purgeResult = await prisma.subscriber.deleteMany({
            where: {
                active: false,
                confirmedAt: null,
                tokenExpiresAt: { not: null, lte: expiredUnconfirmedCutoff },
            },
        })
        unconfirmedPurged = purgeResult.count
        if (unconfirmedPurged > 0) {
            logger.info('suppression-cleanup', `Purged ${unconfirmedPurged} expired unconfirmed subscriber(s)`)
        }

        logger.info('suppression-cleanup', `Cron: lifted ${expiredLifted} expired, reactivated ${subscribersReactivated} subscribers, pruned ${bounceEventsPruned} old bounce events, purged ${unconfirmedPurged} unconfirmed`)

        return NextResponse.json({
            ok: true,
            expiredLifted,
            subscribersReactivated,
            bounceEventsPruned,
            unconfirmedPurged,
        })
    } catch (err) {
        logger.error('suppression-cleanup', 'Cron failed', { error: err as Error })
        return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 })
    }
}
