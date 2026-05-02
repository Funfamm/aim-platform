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
import { sendEmail, htmlToPlainText } from '@/lib/mailer'
import { logger } from '@/lib/logger'
import { isEmailSuppressed, recordBounce, classifyBounceError } from '@/lib/suppression'
import { domainRateLimiter } from '@/lib/rate-limiter'
import { getBulkTransportConfig } from '@/lib/transport-resolver'
import { sendViaACS } from '@/lib/acs-email'
import { buildUnsubscribeUrl } from '@/lib/unsubscribe-token'
import crypto from 'crypto'

// ── Configuration ──────────────────────────────────────────────────────────
const BATCH_SIZE = 20           // emails per batch (ACS fire-and-forget: ~1-2s per send)
const BATCH_DELAY_MS = 1000    // 1s between batches — gentle pacing
const MAX_PER_RUN = 200         // max emails per cron run (maxDuration: 300s)

const MAX_RUNTIME_MS = 280000  // stop claiming new batches after 280s (leave 20s buffer from 300s maxDuration)

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

        // ── STEP 0: STALE CLAIM RECOVERY ────────────────────────────────────
        // Reset jobs stuck in 'processing' for >5 minutes (worker timeout/crash)
        // Increments timeoutCount (NOT attempts — attempts is only for real send failures)
        const staleReset: Array<{ id: string }> = await prisma.$queryRawUnsafe(`
            UPDATE "EmailQueue"
            SET status = 'pending', "claimedAt" = NULL, "updatedAt" = NOW(),
                "timeoutCount" = COALESCE("timeoutCount", 0) + 1
            WHERE status = 'processing'
              AND (
                ("claimedAt" IS NOT NULL AND "claimedAt" < NOW() - INTERVAL '5 minutes')
                OR ("claimedAt" IS NULL AND "updatedAt" < NOW() - INTERVAL '5 minutes')
              )
            RETURNING id
        `)
        if (staleReset.length > 0) {
            logger.warn('email-worker', `Recovered ${staleReset.length} stale 'processing' jobs`)

            // Admin alert when >10 jobs are stuck (sign of systemic issue)
            if (staleReset.length > 10) {
                try {
                    let adminEmail = process.env.ADMIN_EMAIL
                    if (!adminEmail) {
                        const settings = await prisma.siteSettings.findFirst({ select: { notifyEmail: true } })
                        adminEmail = settings?.notifyEmail || undefined
                    }
                    if (adminEmail) {
                        const { sendTransactionalEmail } = await import('@/lib/email-router')
                        await sendTransactionalEmail({
                            to: adminEmail,
                            subject: `⚠️ AIM Studio: ${staleReset.length} stuck email jobs recovered`,
                            html: `<p>${staleReset.length} email jobs were stuck in 'processing' and have been reset.</p><p>This may indicate a worker timeout issue. Check Vercel function logs.</p><p>Time: ${new Date().toISOString()}</p>`,
                        })
                    }
                } catch (alertErr) {
                    logger.error('email-worker', 'Failed to send stuck-jobs admin alert', { error: alertErr })
                }
            }
        }

        // ── Mark exhausted jobs as permanently failed ──
        // Only real send failures (attempts >= 3) cause permanent failure — NOT timeouts
        const exhausted = await prisma.emailQueue.updateMany({
            where: { status: 'pending', attempts: { gte: 3 } },
            data: { status: 'failed', error: 'Max send attempts exceeded (3 genuine delivery failures)' },
        })
        if (exhausted.count > 0) {
            logger.warn('email-worker', `Marked ${exhausted.count} jobs as failed (max attempts exceeded)`)
        }

        // ── ATOMIC CLAIM: grab + lock pending jobs in one query ────────────
        while (processed < MAX_PER_RUN && (Date.now() - startTime) < MAX_RUNTIME_MS) {
            const claimed: Array<{
                id: string; to: string; subject: string; html: string;
                text: string | null; replyTo: string | null;
                attempts: number; maxAttempts: number; type: string;
            }> = await prisma.$queryRawUnsafe(`
                UPDATE "EmailQueue"
                SET "status" = 'processing', "claimedAt" = NOW(), "updatedAt" = NOW()
                WHERE "id" IN (
                    SELECT "id" FROM "EmailQueue"
                    WHERE "status" = 'pending'
                      AND "nextRunAt" <= NOW()
                      AND "attempts" < 3
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
                        // Suppression gate — skip if address was suppressed after enqueue
                        const suppressReason = await isEmailSuppressed(job.to)
                        if (suppressReason) {
                            await db.emailQueue.update({
                                where: { id: job.id },
                                data: { status: 'cancelled', error: `Suppressed: ${suppressReason}` },
                            })
                            logger.info('email-worker', `Job ${job.id} SUPPRESSED (${suppressReason}): ${job.to}`)
                            return
                        }

                        // Rate limiter gate — prevent domain/global send flooding
                        const rateCheck = domainRateLimiter.canSend(job.to)
                        if (!rateCheck.allowed) {
                            await db.emailQueue.update({
                                where: { id: job.id },
                                data: {
                                    status: 'pending',
                                    nextRunAt: new Date(Date.now() + rateCheck.retryAfterMs),
                                },
                            })
                            logger.info('email-worker', `Job ${job.id} rate-limited, re-queued for ${rateCheck.retryAfterMs}ms`)
                            retried++
                            return
                        }

                        // ── Route via configured transport ─────────────────────────
                        // ACS is only for subscriber/newsletter emails (different sender domain).
                        // Member emails (announcement, content_publish, new_role, etc.) always
                        // use Graph to maintain sender reputation and domain consistency.
                        let success = false
                        const isSubscriberEmail = job.type === 'broadcast' || job.type === 'subscriber' || job.type === 'newsletter' || job.type === 'conversion_campaign' || job.type === 'survey_campaign' || job.type.startsWith('subscriber_')
                        const bulkConfig = await getBulkTransportConfig()
                        const useAcs = isSubscriberEmail && bulkConfig.transport === 'acs' && bulkConfig.acsConnectionString && bulkConfig.acsSenderAddress

                        if (useAcs) {
                            // ACS subscriber path — inject List-Unsubscribe headers
                            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
                            const unsubUrl = buildUnsubscribeUrl(siteUrl, job.to, 'subscriber')
                            const headers: Record<string, string> = {
                                'List-Unsubscribe': `<${unsubUrl}>`,
                                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                                'Precedence': 'bulk',
                            }

                            try {
                                // Inject tracking pixel for open-rate analytics (same as Graph path in mailer.ts)
                                const trackingId = crypto.randomUUID()
                                let htmlWithPixel = job.html
                                const pixelUrl = `${siteUrl}/api/track/open/${trackingId}`
                                const trackingPixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`
                                if (htmlWithPixel.includes('</body>')) {
                                    htmlWithPixel = htmlWithPixel.replace('</body>', `${trackingPixel}</body>`)
                                } else {
                                    const lastDiv = htmlWithPixel.lastIndexOf('</div>')
                                    if (lastDiv !== -1) {
                                        htmlWithPixel = htmlWithPixel.slice(0, lastDiv) + trackingPixel + htmlWithPixel.slice(lastDiv)
                                    } else {
                                        htmlWithPixel += trackingPixel
                                    }
                                }

                                await sendViaACS(
                                    { connectionString: bulkConfig.acsConnectionString!, senderAddress: bulkConfig.acsSenderAddress! },
                                    { to: job.to, subject: job.subject, html: htmlWithPixel, text: job.text || htmlToPlainText(job.html), senderAddress: bulkConfig.acsSenderAddress!, replyTo: job.replyTo || undefined, headers }
                                )
                                success = true

                                // Log to EmailLog so ACS sends appear in analytics dashboard
                                prisma.emailLog.create({
                                    data: {
                                        trackingId,
                                        to: job.to,
                                        subject: job.subject,
                                        type: job.type || 'broadcast',
                                        transport: 'acs',
                                        success: true,
                                        bounceCategory: null,
                                    },
                                }).catch(() => { /* non-critical log failure */ })
                            } catch (acsErr) {
                                const acsMsg = acsErr instanceof Error ? acsErr.message : String(acsErr)
                                logger.error('email-worker', `ACS send failed for job ${job.id}: ${acsMsg}`)

                                // Log ACS failure to EmailLog for analytics visibility
                                prisma.emailLog.create({
                                    data: {
                                        to: job.to,
                                        subject: job.subject,
                                        type: job.type || 'broadcast',
                                        transport: 'acs',
                                        success: false,
                                        error: acsMsg.slice(0, 2000),
                                        bounceCategory: classifyBounceError(acsMsg),
                                    },
                                }).catch(() => { /* non-critical */ })

                                throw new Error(`ACS: ${acsMsg}`)
                            }
                        } else {
                            // Graph path — for member emails and fallback when ACS not configured
                            success = await sendEmail({
                                to: job.to,
                                subject: job.subject,
                                html: job.html,
                                text: job.text || undefined,
                                replyTo: job.replyTo || undefined,
                            })
                        }

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

        // ── AUTO-PURGE: clean up old logs/queue records ───────────────────
        let purged = 0
        try {
            const settings = await db.siteSettings.findFirst({ select: { logRetentionDays: true } })
            const retentionDays = settings?.logRetentionDays ?? 90
            if (retentionDays > 0) {
                const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

                const [logResult, queueResult, bounceResult] = await Promise.all([
                    // Purge old email logs
                    db.emailLog.deleteMany({ where: { sentAt: { lt: cutoff } } }),
                    // Purge completed/failed/cancelled queue entries (never delete pending/processing)
                    db.emailQueue.deleteMany({
                        where: {
                            createdAt: { lt: cutoff },
                            status: { in: ['sent', 'failed', 'cancelled'] },
                        },
                    }),
                    // Purge old bounce events
                    db.emailBounceEvent.deleteMany({ where: { occurredAt: { lt: cutoff } } }),
                ])

                purged = (logResult?.count ?? 0) + (queueResult?.count ?? 0) + (bounceResult?.count ?? 0)
                if (purged > 0) {
                    logger.info('email-worker', `Auto-purge: removed ${purged} records older than ${retentionDays} days (logs=${logResult?.count}, queue=${queueResult?.count}, bounces=${bounceResult?.count})`)
                }
            }
        } catch (purgeErr) {
            // Non-critical — log but never fail the cron run
            logger.warn('email-worker', 'Auto-purge failed', { error: purgeErr as Error })
        }

        const elapsed = Date.now() - startTime
        logger.info('email-worker', `Cron run: ${processed} processed, ${sent} sent, ${failed} failed, ${retried} retried, ${purged} purged (${elapsed}ms)`)

        return NextResponse.json({
            ok: true,
            processed,
            sent,
            failed,
            retried,
            purged,
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

    // Track bounce via suppression engine (replaces old manual subscriber deactivation)
    if (!isThrottle) {
        const bounceCategory = classifyBounceError(errorMsg)
        await recordBounce(job.to, bounceCategory, errorMsg, 'worker').catch(() => { /* non-critical */ })
    }
}
