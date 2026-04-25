/**
 * Email Queue Worker — Cron endpoint
 * ---------------------------------------------------------------------------
 * Triggered by Vercel Cron every 60 seconds.
 *
 * Drains the EmailQueue table in priority order using ATOMIC CLAIM:
 *   UPDATE ... SET status = 'processing' WHERE status = 'pending'
 *   ORDER BY priority ASC, nextRunAt ASC
 *   LIMIT batch_size
 *   RETURNING *
 *
 * This prevents duplicate sends across overlapping cron invocations.
 *
 * Retry strategy:
 *   - GraphThrottleError (429) → nextRunAt = now + Retry-After
 *   - Other errors             → nextRunAt = now + exponential backoff (30s, 60s, 120s)
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/mailer'
import { logger } from '@/lib/logger'

// ── Configuration ──────────────────────────────────────────────────────────
const BATCH_SIZE = 4           // emails per batch (matches Graph concurrency limit)
const BATCH_DELAY_MS = 2000    // delay between batches (matches stabilized setting)
const MAX_PER_RUN = 20         // max emails per cron invocation (prevents timeout)

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function GET(request: Request) {
    // Verify cron secret to prevent unauthorized triggers
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startTime = Date.now()
    let processed = 0
    let sent = 0
    let failed = 0
    let retried = 0

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any

        // ── ATOMIC CLAIM: grab + lock pending jobs in one query ────────────
        // Raw SQL ensures SELECT + UPDATE is atomic — no race conditions
        while (processed < MAX_PER_RUN) {
            // Claim a batch atomically using UPDATE ... FROM (SELECT ... FOR UPDATE SKIP LOCKED)
            const claimed: Array<{
                id: string; to: string; subject: string; html: string;
                text: string | null; replyTo: string | null;
                attempts: number; maxAttempts: number; type: string;
            }> = await prisma.$queryRawUnsafe(`
                UPDATE "EmailQueue"
                SET "status" = 'processing', "updatedAt" = NOW()
                WHERE "id" IN (
                    SELECT "id" FROM "EmailQueue"
                    WHERE "status" = 'pending'
                      AND "nextRunAt" <= NOW()
                    ORDER BY "priority" ASC, "nextRunAt" ASC
                    LIMIT ${BATCH_SIZE}
                    FOR UPDATE SKIP LOCKED
                )
                RETURNING "id", "to", "subject", "html", "text", "replyTo", "attempts", "maxAttempts", "type"
            `)

            if (claimed.length === 0) break  // queue is empty

            // Process the claimed batch concurrently
            const results = await Promise.allSettled(
                claimed.map(async (job) => {
                    try {
                        const success = await sendEmail({
                            to: job.to,
                            subject: job.subject,
                            html: job.html,
                            text: job.text || undefined,
                            replyTo: job.replyTo || undefined,
                        })

                        if (success) {
                            // Mark as sent
                            await db.emailQueue.update({
                                where: { id: job.id },
                                data: { status: 'sent', sentAt: new Date() },
                            })
                            sent++
                        } else {
                            // sendEmail returned false — treat as soft failure
                            await handleJobFailure(db, job, new Error('sendEmail returned false'))
                        }
                    } catch (err) {
                        await handleJobFailure(db, job, err)
                    }
                })
            )

            processed += claimed.length

            // Count failures from this batch
            for (const r of results) {
                if (r.status === 'rejected') failed++
            }

            // Inter-batch delay to prevent Graph throttling
            if (processed < MAX_PER_RUN) {
                await sleep(BATCH_DELAY_MS)
            }
        }

        const elapsed = Date.now() - startTime
        logger.info('email-worker', `Cron run: ${processed} processed, ${sent} sent, ${failed} failed, ${retried} retried (${elapsed}ms)`)

        return NextResponse.json({
            ok: true,
            processed,
            sent,
            failed,
            retried,
            elapsed: `${elapsed}ms`,
        })
    } catch (err) {
        logger.error('email-worker', 'Cron worker failed', { error: err as Error })
        return NextResponse.json({ error: 'Worker failed' }, { status: 500 })
    }
}

// ── Retry logic with explicit scheduling ───────────────────────────────────

async function handleJobFailure(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: any,
    job: { id: string; attempts: number; maxAttempts: number; to: string; subject: string },
    err: unknown,
): Promise<void> {
    const newAttempts = job.attempts + 1
    const errorMsg = err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500)

    // Check if this is a Graph 429 throttle (error message carries retry info)
    const isThrottle = errorMsg.includes('429') || errorMsg.includes('throttle')

    if (newAttempts >= job.maxAttempts) {
        // ── Exhausted: mark as permanently failed ──────────────────────────
        await db.emailQueue.update({
            where: { id: job.id },
            data: {
                status: 'failed',
                attempts: newAttempts,
                error: errorMsg,
            },
        })
        logger.error('email-worker', `Job ${job.id} permanently failed after ${newAttempts} attempts: ${job.to} — ${job.subject}`)
    } else {
        // ── Schedule retry with appropriate delay ──────────────────────────
        let delayMs: number

        if (isThrottle) {
            // Graph 429 → respect server guidance (extract from error or default 30s)
            const retryMatch = errorMsg.match(/retry after (\d+)ms/i)
            delayMs = retryMatch ? parseInt(retryMatch[1], 10) : 30_000
            delayMs = Math.max(delayMs, 5_000)  // floor at 5s
        } else {
            // Other errors → exponential backoff: 30s, 60s, 120s
            delayMs = 30_000 * Math.pow(2, newAttempts - 1)
        }

        const nextRunAt = new Date(Date.now() + delayMs)

        await db.emailQueue.update({
            where: { id: job.id },
            data: {
                status: 'pending',     // back to pending for next worker run
                attempts: newAttempts,
                error: errorMsg,
                nextRunAt,
            },
        })
        logger.warn('email-worker', `Job ${job.id} attempt ${newAttempts}/${job.maxAttempts} failed${isThrottle ? ' (429 throttled)' : ''}, retry at ${nextRunAt.toISOString()} (${delayMs}ms)`)
    }

    // Track bounce for subscriber hygiene (non-throttle failures only)
    if (!isThrottle) {
        await trackBounce(db, job.to)
    }
}

// ── Bounce Management ──────────────────────────────────────────────────────
// Tracks delivery failures per subscriber email.
// After 3+ bounces, auto-deactivates the subscriber to prevent wasted sends.

const BOUNCE_THRESHOLD = 3

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function trackBounce(db: any, email: string): Promise<void> {
    try {
        const normalizedEmail = email.toLowerCase().trim()

        // Count total failures for this email in EmailLog
        const failCount = await db.emailLog.count({
            where: { to: normalizedEmail, success: false },
        })

        if (failCount >= BOUNCE_THRESHOLD) {
            // Check if they're an active subscriber
            const subscriber = await db.subscriber.findUnique({
                where: { email: normalizedEmail },
                select: { id: true, active: true },
            })

            if (subscriber?.active) {
                await db.subscriber.update({
                    where: { email: normalizedEmail },
                    data: { active: false },
                })
                logger.warn('email-worker', `Auto-deactivated subscriber ${normalizedEmail} — ${failCount} delivery failures (bounce threshold: ${BOUNCE_THRESHOLD})`)
            }
        }
    } catch {
        // Never let bounce tracking crash the worker
    }
}
