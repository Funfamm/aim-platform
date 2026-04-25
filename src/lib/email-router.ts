/**
 * AIM Studio – Email Router
 * ---------------------------------------------------------------------------
 * Classification + routing layer that sits above sendEmail().
 *
 * Two pipelines:
 *  1. sendTransactionalEmail() → immediate sendEmail() → never queued
 *  2. sendBulkEmail()          → EmailQueue DB table   → cron worker processes
 *
 * Callers NEVER touch sendEmail() directly anymore (except the cron worker).
 */
import { sendEmail } from '@/lib/mailer'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

// ── Priority levels ────────────────────────────────────────────────────────
export const EMAIL_PRIORITY = {
    CRITICAL: 0,  // OTP, password reset, MFA
    HIGH: 1,      // security alerts, password change confirm
    NORMAL: 2,    // receipts, welcome, application confirm
    LOW: 3,       // broadcasts, newsletters, announcements
} as const

export type EmailPriority = (typeof EMAIL_PRIORITY)[keyof typeof EMAIL_PRIORITY]

// ── Types ──────────────────────────────────────────────────────────────────
export interface TransactionalEmailOptions {
    to: string
    subject: string
    html: string
    text?: string
    replyTo?: string
    /** Explicit type tag for EmailLog analytics. Defaults to 'transactional'. */
    type?: string
}

export interface BulkEmailOptions {
    to: string
    subject: string
    html: string
    text?: string
    replyTo?: string
    /** Email type for grouping: broadcast | announcement | content_publish | new_role */
    type?: string
    /** Priority level. Defaults to LOW (3). */
    priority?: EmailPriority
    /** Campaign ID to group related emails for admin tracking. */
    campaignId?: string
}

// ── Transactional Pipeline ─────────────────────────────────────────────────

/**
 * Send a transactional email immediately. Never queued, never delayed.
 * Use for: auth, security, password reset, OTP, welcome, receipts.
 *
 * This is a thin wrapper around sendEmail() — same retry, same logging.
 */
export async function sendTransactionalEmail(options: TransactionalEmailOptions): Promise<boolean> {
    return sendEmail({
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
    })
}

// ── Bulk Pipeline ──────────────────────────────────────────────────────────

/**
 * Enqueue an email for async processing by the cron worker.
 * Returns the queue record ID for tracking.
 *
 * Use for: broadcasts, announcements, content publish, subscriber newsletters.
 */
export async function sendBulkEmail(options: BulkEmailOptions): Promise<string> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const record = await (prisma as any).emailQueue.create({
            data: {
                to: options.to,
                subject: options.subject,
                html: options.html,
                text: options.text || null,
                replyTo: options.replyTo || null,
                type: options.type || 'broadcast',
                priority: options.priority ?? EMAIL_PRIORITY.LOW,
                campaignId: options.campaignId || null,
                status: 'pending',
                attempts: 0,
                maxAttempts: 3,
            },
        })
        return record.id
    } catch (err) {
        logger.error('email-router', `Failed to enqueue email to ${options.to}`, { error: err as Error })
        // Fallback: send immediately to avoid losing the email
        logger.warn('email-router', `Falling back to immediate send for ${options.to}`)
        await sendEmail({
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
            replyTo: options.replyTo,
        })
        return 'fallback-immediate'
    }
}

/**
 * Bulk-enqueue multiple emails at once for a broadcast campaign.
 * Deduplicates recipients by email address before inserting.
 * Returns the campaign ID for tracking.
 */
export async function enqueueBroadcastCampaign(
    recipients: { email: string }[],
    buildEmail: (email: string) => { subject: string; html: string; replyTo?: string },
    type: string = 'broadcast',
    priority: EmailPriority = EMAIL_PRIORITY.LOW,
): Promise<{ campaignId: string; enqueued: number }> {
    const campaignId = crypto.randomUUID()

    // ── Deduplicate by email ──────────────────────────────────────────────
    const seen = new Set<string>()
    const unique = recipients.filter(r => {
        const normalized = r.email.toLowerCase().trim()
        if (seen.has(normalized)) return false
        seen.add(normalized)
        return true
    })

    // ── Batch insert ──────────────────────────────────────────────────────
    const BATCH = 50  // Prisma createMany batch size
    let enqueued = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any

    for (let i = 0; i < unique.length; i += BATCH) {
        const batch = unique.slice(i, i + BATCH)
        const data = batch.map(r => {
            const email = buildEmail(r.email)
            return {
                to: r.email,
                subject: email.subject,
                html: email.html,
                replyTo: email.replyTo || null,
                type,
                priority,
                campaignId,
                status: 'pending',
                attempts: 0,
                maxAttempts: 3,
            }
        })

        try {
            await db.emailQueue.createMany({ data })
            enqueued += data.length
        } catch (err) {
            logger.error('email-router', `Batch insert failed at offset ${i}`, { error: err as Error })
        }
    }

    logger.info('email-router', `Campaign ${campaignId}: ${enqueued}/${unique.length} emails enqueued (type=${type})`)
    return { campaignId, enqueued }
}
