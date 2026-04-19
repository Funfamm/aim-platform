/**
 * Notification Queue (BullMQ)
 * ---------------------------------------------------------------------------
 * Handles all outbound notification jobs: email + in-app.
 *
 * Enhancements over v1:
 *  - 5 retries with exponential back-off (2^attempt * 1_000 ms)
 *  - Dead-Letter Queue (DLQ): failed jobs moved to "failedNotifications" queue
 *  - Redis Pub/Sub publish on success (feeds real-time WebSocket / poll clients)
 *  - Prometheus metrics hooks (recordNotificationJob)
 *
 * Redis: set REDIS_URL to your Upstash rediss:// URL in production.
 * Worker: started via src/instrumentation.ts on server boot (Node runtime only).
 * If REDIS_URL is not set, all queue operations are silently skipped.
 */
import { Queue, Worker, Job } from 'bullmq'
import { sendEmail } from '@/lib/mailer'
import { logger } from '@/lib/logger'
import { recordNotificationJob } from '@/lib/metrics'
import { Redis as UpstashRedis } from '@upstash/redis'

// ─── Job payload types ─────────────────────────────────────────────────────

export interface NotificationJobPayload {
    type: 'email' | 'in_app' | 'both'
    userId?: string           // target user (for in-app + pub/sub)
    email?: string            // recipient email address
    subject?: string
    html?: string
    notificationId?: string  // UserNotification row id (for logging)
}

// ─── Lazy connection factory ───────────────────────────────────────────────

function buildConnection() {
    const redisUrl = process.env.REDIS_URL
    if (!redisUrl) return null

    const parsedUrl = new URL(redisUrl)
    const isTls = redisUrl.startsWith('rediss://')
    return {
        host: parsedUrl.hostname,
        port: parseInt(parsedUrl.port || '6379', 10),
        ...(parsedUrl.password ? { password: decodeURIComponent(parsedUrl.password) } : {}),
        ...(isTls ? { tls: {} } : {}),
    }
}

// ─── Queue singleton (lazy) ────────────────────────────────────────────────

let _queue: Queue<NotificationJobPayload> | null = null

export function getNotificationQueue(): Queue<NotificationJobPayload> | null {
    if (!process.env.REDIS_URL) return null
    if (_queue) return _queue

    const connection = buildConnection()!
    _queue = new Queue<NotificationJobPayload>('notifications', {
        connection,
        defaultJobOptions: {
            attempts: 5,                                          // ↑ from 3 to 5
            backoff: { type: 'exponential', delay: 1_000 },      // 1s, 2s, 4s, 8s, 16s
            removeOnComplete: { age: 60 * 60 * 24 },             // keep 24 h on success
            removeOnFail: false,                                  // keep ALL failures → DLQ
        },
    })
    return _queue
}

// ─── Dead-Letter Queue ────────────────────────────────────────────────────

let _dlq: Queue<NotificationJobPayload> | null = null

export function getFailedNotificationsQueue(): Queue<NotificationJobPayload> | null {
    if (!process.env.REDIS_URL) return null
    if (_dlq) return _dlq

    const connection = buildConnection()!
    _dlq = new Queue<NotificationJobPayload>('failedNotifications', {
        connection,
        defaultJobOptions: {
            removeOnComplete: { age: 60 * 60 * 24 * 7 }, // keep 7 days
        },
    })
    return _dlq
}

/**
 * Add a job to the notification queue.
 * Silently no-ops when Redis is unavailable (CI / local dev without Redis).
 */
export async function addNotificationJob(payload: NotificationJobPayload): Promise<void> {
    const queue = getNotificationQueue()
    if (!queue) {
        logger.warn('notificationQueue', 'REDIS_URL not set — skipping queued notification', { type: payload.type })
        return
    }
    await queue.add('notification', payload)
}

// Keep named export for backwards-compat callers
export const notificationQueue = {
    add: async (_name: string, payload: NotificationJobPayload) => addNotificationJob(payload),
}

// ─── Worker ────────────────────────────────────────────────────────────────

// ─── Upstash REST pub signal (replaces the old TCP redis pub/sub client) ────────────
let workerStarted = false
let _upstash: UpstashRedis | null = null
function getUpstash(): UpstashRedis | null {
    const url   = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !token) return null
    if (!_upstash) _upstash = new UpstashRedis({ url, token })
    return _upstash
}

export function startNotificationWorker() {
    if (!process.env.REDIS_URL) {
        logger.warn('notificationQueue', 'REDIS_URL not set — notification worker disabled')
        return
    }
    if (workerStarted) return
    workerStarted = true

    const connection = buildConnection()!

    const worker = new Worker<NotificationJobPayload>(
        'notifications',
        async (job: Job<NotificationJobPayload>) => {
            const { type, email, subject, html, notificationId, userId } = job.data

            // ── Email leg ─────────────────────────────────────────────────
            if ((type === 'email' || type === 'both') && email && subject && html) {
                const sent = await sendEmail({ to: email, subject, html })
                if (!sent) throw new Error(`Email delivery failed for job ${job.id}`)
            }

            // ── Redis Pub/Sub (real-time feed signal) ─────────────────────
            // ── Upstash REST signal (real-time feed hint for polling clients) ──────
            if (userId) {
                try {
                    const upstash = getUpstash()
                    if (upstash) {
                        await upstash.set(
                            `notifications:signal:${userId}`,
                            new Date().toISOString(),
                            { ex: 30 },
                        )
                    }
                } catch (pubErr) {
                    logger.warn('notificationQueue', `Upstash signal failed: ${(pubErr as Error).message}`)
                }
            }

            if (notificationId) {
                logger.info('notificationQueue', `Job ${job.id} delivered notificationId=${notificationId}`)
            }
        },
        { connection, concurrency: 5 }
    )

    worker.on('completed', (job) => {
        logger.info('notificationQueue', `Job ${job.id} completed (${job.data.type})`)
        recordNotificationJob('completed', job.data.type)
    })

    worker.on('failed', async (job, err) => {
        logger.error('notificationQueue', `Job ${job?.id} failed: ${err.message}`, { error: err })
        recordNotificationJob('failed', job?.data.type ?? 'unknown')

        // Move to DLQ after all retries exhausted
        if (job && (job.attemptsMade ?? 0) >= (job.opts?.attempts ?? 5)) {
            const dlq = getFailedNotificationsQueue()
            if (dlq) {
                await dlq.add('dlq', job.data).catch(() => {})
                logger.warn('notificationQueue', `Job ${job.id} moved to DLQ after ${job.attemptsMade} attempts`)
            }
        }
    })

    logger.info('notificationQueue', 'Worker started (5 retries, DLQ enabled)')
    return worker
}
