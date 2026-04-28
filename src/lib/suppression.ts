/**
 * AIM Studio – Email Suppression Engine
 * ---------------------------------------------------------------------------
 * Centralized bounce tracking + suppression logic.
 *
 * Every email send MUST check `isEmailSuppressed()` before attempting delivery.
 * On failure, call `recordBounce()` to classify + track + auto-suppress.
 *
 * Suppression rules:
 *   - 1 hard bounce     → immediate permanent suppression
 *   - 3 soft bounces/7d → temporary suppression (7-day expiry)
 *   - 1 complaint       → immediate permanent suppression
 *   - Admin manual      → permanent until lifted
 */
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

// ── Constants ──────────────────────────────────────────────────────────────
const SOFT_BOUNCE_THRESHOLD = 3          // soft bounces before temp suppression
const SOFT_BOUNCE_WINDOW_DAYS = 7        // rolling window for soft bounce counting
const SOFT_SUPPRESSION_EXPIRY_DAYS = 7   // how long a soft-bounce suppression lasts

// ── Bounce Classification ──────────────────────────────────────────────────

export type BounceCategory = 'hard_bounce' | 'soft_bounce' | 'complaint' | 'throttle'

/**
 * Parse an SMTP/Graph/ACS error message into a bounce category.
 * Returns null for transient/throttle issues that should NOT trigger suppression.
 */
export function classifyBounceError(errorMsg: string): BounceCategory {
    const e = errorMsg.toLowerCase()

    // ── Complaints (highest priority — check first) ─────────────────────
    if (e.includes('complained') || e.includes('abuse') || e.includes('spam report')) {
        return 'complaint'
    }

    // ── Throttle (never suppress) ───────────────────────────────────────
    if (e.includes('429') || e.includes('throttle') || e.includes('rate limit') ||
        e.includes('too many') || e.includes('retry after')) {
        return 'throttle'
    }

    // ── Hard bounces (permanent) ────────────────────────────────────────
    // 5.1.x — mailbox/user doesn't exist
    if (e.includes('550 5.1.') || e.includes('user unknown') || e.includes('does not exist') ||
        e.includes('no such user') || e.includes('mailbox not found') || e.includes('unknown user') ||
        e.includes('recipient rejected') || e.includes('address rejected') ||
        e.includes('invalid recipient') || e.includes('undeliverable')) {
        return 'hard_bounce'
    }

    // 5.7.x — blocked / policy rejection / spam
    if (e.includes('550 5.7.') || e.includes('blocked') || e.includes('rejected') ||
        e.includes('spam') || e.includes('blacklisted') || e.includes('suspected as spam') ||
        e.includes('dmarc') || e.includes('spf') || e.includes('not allowed')) {
        return 'hard_bounce'
    }

    // 5.2.x — mailbox full/disabled/over quota (sometimes permanent)
    if (e.includes('550 5.2.') || e.includes('account disabled') || e.includes('account has been disabled') ||
        e.includes('inactive') || e.includes('deactivated')) {
        return 'hard_bounce'
    }

    // SendGrid / Graph specific hard bounces
    if (e.includes('sender identity') || e.includes('does not match a verified')) {
        return 'hard_bounce'
    }
    if (e.includes('errorparticipant') || e.includes('emailaddress')) {
        return 'hard_bounce'
    }
    if (e.includes('username and password not accepted') || e.includes('invalid login')) {
        return 'hard_bounce'  // config error — treat as hard bounce to flag immediately
    }

    // ── Soft bounces (transient) ────────────────────────────────────────
    // 4.x.x — temporary failures
    if (e.includes('421 ') || e.includes('450 ') || e.includes('451 ') || e.includes('452 ')) {
        return 'soft_bounce'
    }
    // Mailbox full (transient — might clear up)
    if (e.includes('552') || e.includes('mailbox full') || e.includes('over quota') ||
        e.includes('storage limit')) {
        return 'soft_bounce'
    }
    // Connection failures (might be transient)
    if (e.includes('connection') || e.includes('tls') || e.includes('timeout') ||
        e.includes('greeting never received') || e.includes('socket disconnected') ||
        e.includes('econnrefused') || e.includes('network')) {
        return 'soft_bounce'
    }

    // Default: treat unknown errors as soft bounce (safer — won't permanently suppress)
    return 'soft_bounce'
}

// ── Suppression Checks ─────────────────────────────────────────────────────

/**
 * Check if an email address is on the suppression list.
 * Returns the reason string if suppressed, or null if clear to send.
 *
 * Soft-bounce suppressions expire after SOFT_SUPPRESSION_EXPIRY_DAYS
 * and are automatically cleaned up.
 */
export async function isEmailSuppressed(email: string): Promise<string | null> {
    const normalized = email.toLowerCase().trim()

    try {
        const record = await prisma.emailSuppression.findUnique({
            where: { email: normalized },
            select: { reason: true, expiresAt: true, removedAt: true },
        })

        if (!record) return null

        // Admin lifted the suppression
        if (record.removedAt) return null

        // Soft-bounce suppression expired — clear it
        if (record.expiresAt && record.expiresAt < new Date()) {
            // Fire-and-forget cleanup
            prisma.emailSuppression.delete({
                where: { email: normalized },
            }).catch(() => { /* non-critical */ })
            return null
        }

        return record.reason
    } catch {
        // Never block sends on suppression-check failure
        return null
    }
}

// ── Bounce Recording ───────────────────────────────────────────────────────

/**
 * Record a bounce for an email address.
 * Persists to EmailBounceEvent, updates subscriber stats, and auto-suppresses
 * when thresholds are exceeded.
 *
 * @param email     - recipient address
 * @param category  - classified bounce type
 * @param detail    - raw error message
 * @param source    - where the bounce was detected (mailer | webhook | worker)
 */
export async function recordBounce(
    email: string,
    category: BounceCategory,
    detail: string,
    source: 'mailer' | 'webhook' | 'worker' = 'mailer',
): Promise<void> {
    const normalized = email.toLowerCase().trim()

    // Throttle errors are NEVER recorded as bounces — they're infrastructure issues
    if (category === 'throttle') return

    try {
        // ── Persist bounce event (single source of truth for counting) ──
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).emailBounceEvent.create({
            data: {
                email: normalized,
                bounceType: category,
                source,
                detail: detail.slice(0, 2000),
            },
        })

        // ── Update Subscriber bounce stats (if they're a subscriber) ────
        try {
            await prisma.subscriber.updateMany({
                where: { email: normalized },
                data: {
                    bounceCount: { increment: 1 },
                    lastBounceAt: new Date(),
                },
            })
        } catch { /* subscriber may not exist — that's fine */ }

        // ── Decide suppression ──────────────────────────────────────────
        if (category === 'hard_bounce' || category === 'complaint') {
            // Immediate permanent suppression
            await upsertSuppression(normalized, category, 'permanent', detail, source)
            logger.warn('suppression', `⛔ ${category.toUpperCase()}: ${normalized} — permanently suppressed`)
        } else if (category === 'soft_bounce') {
            // Count recent soft bounces from EmailBounceEvent (not EmailLog)
            const windowStart = new Date(Date.now() - SOFT_BOUNCE_WINDOW_DAYS * 24 * 60 * 60 * 1000)

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const recentBounces = await (prisma as any).emailBounceEvent.count({
                where: {
                    email: normalized,
                    bounceType: 'soft_bounce',
                    occurredAt: { gte: windowStart },
                },
            })

            // Check if threshold reached (current event already counted above)
            if (recentBounces >= SOFT_BOUNCE_THRESHOLD) {
                const expiresAt = new Date(Date.now() + SOFT_SUPPRESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
                await upsertSuppression(normalized, 'soft_bounce', 'transient', detail, source, expiresAt)
                logger.warn('suppression', `⚠️ SOFT BOUNCE threshold (${SOFT_BOUNCE_THRESHOLD}): ${normalized} — temp suppressed until ${expiresAt.toISOString()}`)
            }
        }
    } catch (err) {
        // Never let bounce tracking crash the caller
        logger.error('suppression', `Failed to record bounce for ${normalized}`, { error: err as Error })
    }
}

// ── Public: Suppress an email address ───────────────────────────────────────

/**
 * Suppress an email address — creates/updates the EmailSuppression record
 * and deactivates any matching Subscriber.
 *
 * bounceType is auto-derived from reason:
 *   soft_bounce → 'transient' | everything else → 'permanent'
 *
 * Call sites:
 *   - recordBounce() — automatic after bounce detection
 *   - unsubscribe route — user clicked unsubscribe link
 *   - admin manual suppress — via dashboard
 *   - webhook handler — async ESP feedback
 */
export async function suppressEmail(
    email: string,
    reason: 'hard_bounce' | 'soft_bounce' | 'complaint' | 'unsubscribe' | 'manual' | string,
    detail: string,
    source: string = 'system',
    expiresAt: Date | null = null,
): Promise<void> {
    const normalized = email.toLowerCase().trim()
    const bounceType = reason === 'soft_bounce' ? 'transient' : 'permanent'
    await upsertSuppression(normalized, reason, bounceType, detail, source, expiresAt)
}

// ── Internal: Create/Update Suppression Record ─────────────────────────────

async function upsertSuppression(
    email: string,
    reason: string,
    bounceType: string,
    detail: string,
    source: string = 'system',
    expiresAt?: Date | null,
): Promise<void> {
    try {
        await prisma.emailSuppression.upsert({
            where: { email },
            create: {
                email,
                reason,
                bounceType,
                source,
                detail: detail.slice(0, 2000),
                expiresAt: expiresAt || null,
            },
            update: {
                reason,
                bounceType,
                source,
                detail: detail.slice(0, 2000),
                expiresAt: expiresAt || null,
                removedAt: null,   // re-suppress if admin had lifted it
                removedBy: null,
            },
        })

        // Also mark subscriber as suppressed
        await prisma.subscriber.updateMany({
            where: { email },
            data: {
                suppressedAt: new Date(),
                suppressReason: reason,
                active: false,
            },
        })
    } catch (err) {
        logger.error('suppression', `Failed to suppress ${email}`, { error: err as Error })
    }
}

// ── Admin Actions ──────────────────────────────────────────────────────────

/**
 * Admin lifts a suppression — email can receive again.
 * Audit-logged with admin user ID.
 */
export async function liftSuppression(email: string, adminUserId: string): Promise<boolean> {
    const normalized = email.toLowerCase().trim()

    try {
        const record = await prisma.emailSuppression.findUnique({
            where: { email: normalized },
        })

        if (!record) return false

        await prisma.emailSuppression.update({
            where: { email: normalized },
            data: {
                removedAt: new Date(),
                removedBy: adminUserId,
            },
        })

        // Re-activate subscriber if they exist
        await prisma.subscriber.updateMany({
            where: { email: normalized },
            data: {
                suppressedAt: null,
                suppressReason: null,
                active: true,
            },
        })

        logger.info('suppression', `✅ Admin ${adminUserId} lifted suppression for ${normalized}`)
        return true
    } catch (err) {
        logger.error('suppression', `Failed to lift suppression for ${normalized}`, { error: err as Error })
        return false
    }
}

/**
 * Admin manually adds an email to the suppression list.
 */
export async function manuallySuppress(
    email: string,
    adminUserId: string,
    reason: string = 'manual',
): Promise<boolean> {
    const normalized = email.toLowerCase().trim()

    try {
        await prisma.emailSuppression.upsert({
            where: { email: normalized },
            create: {
                email: normalized,
                reason,
                bounceType: 'permanent',
                source: 'admin',
                detail: `Manually suppressed by admin ${adminUserId}`,
            },
            update: {
                reason,
                source: 'admin',
                detail: `Manually suppressed by admin ${adminUserId}`,
                removedAt: null,
                removedBy: null,
            },
        })

        // Deactivate subscriber
        await prisma.subscriber.updateMany({
            where: { email: normalized },
            data: {
                suppressedAt: new Date(),
                suppressReason: reason,
                active: false,
            },
        })

        logger.info('suppression', `⛔ Admin ${adminUserId} manually suppressed ${normalized}`)
        return true
    } catch (err) {
        logger.error('suppression', `Failed to manually suppress ${normalized}`, { error: err as Error })
        return false
    }
}

/**
 * Purge all suppressed subscribers from the Subscriber table entirely.
 * Returns count of deleted records.
 */
export async function purgeAllSuppressedSubscribers(): Promise<number> {
    try {
        // Get all actively suppressed emails
        const suppressed = await prisma.emailSuppression.findMany({
            where: { removedAt: null },
            select: { email: true },
        })

        if (suppressed.length === 0) return 0

        const emails = suppressed.map(s => s.email)

        const result = await prisma.subscriber.deleteMany({
            where: { email: { in: emails } },
        })

        logger.info('suppression', `🗑️ Purged ${result.count} suppressed subscribers`)
        return result.count
    } catch (err) {
        logger.error('suppression', 'Failed to purge suppressed subscribers', { error: err as Error })
        return 0
    }
}

/**
 * Compute email reputation health score (0-100).
 *   100 = perfect delivery, 0 = everything bouncing
 *
 * Factors:
 *   - Success rate (30d)          — weight: 40%
 *   - Hard bounce rate (30d)      — weight: 30%
 *   - Complaint rate (30d)        — weight: 20%
 *   - Suppression list size       — weight: 10%
 */
export async function computeHealthScore(): Promise<{
    score: number
    successRate: number
    hardBounceRate: number
    complaintRate: number
    suppressedCount: number
    grade: 'excellent' | 'good' | 'warning' | 'critical'
}> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [totalSent, totalSuccess, hardBounces, complaints, suppressedCount] = await Promise.all([
        prisma.emailLog.count({ where: { sentAt: { gte: thirtyDaysAgo } } }),
        prisma.emailLog.count({ where: { sentAt: { gte: thirtyDaysAgo }, success: true } }),
        prisma.emailLog.count({ where: { sentAt: { gte: thirtyDaysAgo }, bounceCategory: 'hard_bounce' } }),
        prisma.emailLog.count({ where: { sentAt: { gte: thirtyDaysAgo }, bounceCategory: 'complaint' } }),
        prisma.emailSuppression.count({ where: { removedAt: null } }),
    ])

    // Avoid division by zero
    if (totalSent === 0) {
        return { score: 100, successRate: 100, hardBounceRate: 0, complaintRate: 0, suppressedCount, grade: 'excellent' }
    }

    const successRate = (totalSuccess / totalSent) * 100
    const hardBounceRate = (hardBounces / totalSent) * 100
    const complaintRate = (complaints / totalSent) * 100

    // Score calculation (higher is better)
    let score = 0
    score += Math.min(successRate, 100) * 0.4                             // 40% weight
    score += Math.max(0, 100 - hardBounceRate * 20) * 0.3                 // 30% weight (penalize hard bounces heavily)
    score += Math.max(0, 100 - complaintRate * 50) * 0.2                  // 20% weight (complaints are very bad)
    score += Math.max(0, 100 - Math.min(suppressedCount, 100)) * 0.1     // 10% weight

    score = Math.round(Math.max(0, Math.min(100, score)))

    const grade = score >= 90 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'warning' : 'critical'

    return { score, successRate: Math.round(successRate * 100) / 100, hardBounceRate: Math.round(hardBounceRate * 100) / 100, complaintRate: Math.round(complaintRate * 100) / 100, suppressedCount, grade }
}
