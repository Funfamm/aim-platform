/**
 * botCleanup.ts
 * ------------------------------------------------------------------
 * Shared service for auto-deleting high-risk bot subscribers.
 * Used by:
 *   - /api/cron/delete-high-bot-subscribers  (nightly background job)
 *   - /api/admin/subscribers/delete-high-risk (admin on-demand action)
 *
 * Every deletion is written to DeletedSubscriberLog for auditing.
 */
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

/** Read threshold from env, defaulting to 80 */
export function getBotDeleteThreshold(): number {
    const env = process.env.AUTO_DELETE_BOT_SCORE
    const parsed = env ? parseInt(env, 10) : NaN
    return isNaN(parsed) ? 80 : parsed
}

export interface BotDeleteResult {
    total: number      // how many matched the threshold
    deleted: number    // how many were actually deleted
}

/**
 * Delete all subscribers with botScore >= threshold.
 * Writes an audit row to DeletedSubscriberLog for each deleted record.
 *
 * @param threshold   - minimum botScore to delete (default: getBotDeleteThreshold())
 * @param reason      - "auto_cron" | "admin_bulk"
 * @param adminUserId - set when triggered manually from admin UI; null for cron
 */
export async function autoDeleteHighRiskBots(
    threshold = getBotDeleteThreshold(),
    reason: 'auto_cron' | 'admin_bulk' = 'auto_cron',
    adminUserId?: string,
): Promise<BotDeleteResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any

    // 1. Fetch all qualifying subscribers (select only what we need for the log)
    const suspects: { id: string; email: string; botScore: number }[] =
        await db.subscriber.findMany({
            where: { botScore: { gte: threshold } },
            select: { id: true, email: true, botScore: true },
        })

    const total = suspects.length

    if (total === 0) {
        logger.info('botCleanup', `No subscribers with botScore >= ${threshold} — nothing to delete`)
        return { total: 0, deleted: 0 }
    }

    // 2. Write audit log rows before deletion (so we never lose the record)
    const now = new Date()
    await db.deletedSubscriberLog.createMany({
        data: suspects.map((s) => ({
            email:       s.email,
            botScore:    s.botScore,
            reason,
            adminUserId: adminUserId ?? null,
            deletedAt:   now,
        })),
    })

    // 3. Bulk-delete from Subscriber table
    const ids = suspects.map((s) => s.id)
    const result = await db.subscriber.deleteMany({ where: { id: { in: ids } } })
    const deleted: number = result.count

    logger.info(
        'botCleanup',
        `Auto-deleted ${deleted}/${total} bot subscribers ` +
        `(threshold=${threshold}, reason=${reason}${adminUserId ? `, admin=${adminUserId}` : ''})`
    )

    return { total, deleted }
}
