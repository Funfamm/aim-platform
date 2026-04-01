/**
 * Notification Queue (BullMQ)
 * ---------------------------------------------------------------------------
 * Handles all outbound notification jobs: email + in-app.
 * Each job is retried up to 3 times with exponential back-off.
 *
 * Redis: set REDIS_URL to your Upstash rediss:// URL in production.
 * Worker: started via src/instrumentation.ts on server boot (Node runtime only).
 * If REDIS_URL is not set, all queue operations are silently skipped.
 *
 * Usage:
 *   import { addNotificationJob } from '@/lib/queues/notificationQueue'
 *   await addNotificationJob(payload)
 */
import { Queue, Worker, Job } from 'bullmq'
import { sendEmail } from '@/lib/mailer'
import { logger } from '@/lib/logger'

// ─── Job payload types ─────────────────────────────────────────────────────
export interface NotificationJobPayload {
    type: 'email' | 'in_app' | 'both'
    userId?: string           // target user (for in-app)
    email?: string            // recipient email address
    subject?: string
    html?: string
    notificationId?: string  // UserNotification row id (for logging)
}

// ─── Lazy connection factory ───────────────────────────────────────────────
// We never touch Redis unless REDIS_URL is explicitly set.
// This prevents ECONNREFUSED errors in CI / local dev without Redis.
function buildConnection() {
    const redisUrl = process.env.REDIS_URL  // strict opt-in — no localhost fallback
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
            attempts: 3,
            backoff: { type: 'exponential', delay: 5_000 },
            removeOnComplete: { age: 60 * 60 * 24 },       // keep 24 h
            removeOnFail:     { age: 60 * 60 * 24 * 7 },   // keep 7 days on failure
        },
    })
    return _queue
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

// Keep named export for backwards-compat callers that import notificationQueue directly
export const notificationQueue = {
    add: async (_name: string, payload: NotificationJobPayload) => addNotificationJob(payload),
}

// ─── Worker ────────────────────────────────────────────────────────────────
// Started once on server boot via instrumentation.ts (Node runtime only).
// Guards against double-start across hot-reload cycles.
let workerStarted = false

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
            const { type, email, subject, html, notificationId } = job.data

            // Email leg
            if ((type === 'email' || type === 'both') && email && subject && html) {
                const sent = await sendEmail({ to: email, subject, html })
                if (!sent) throw new Error(`Email delivery failed for job ${job.id}`)
            }

            if (notificationId) {
                logger.info('notificationQueue', `Job ${job.id} delivered notificationId=${notificationId}`)
            }
        },
        {
            connection,
            concurrency: 5,
        }
    )

    worker.on('completed', (job) => {
        logger.info('notificationQueue', `Job ${job.id} completed (${job.data.type})`)
    })
    worker.on('failed', (job, err) => {
        logger.error('notificationQueue', `Job ${job?.id} failed: ${err.message}`, { error: err })
    })

    logger.info('notificationQueue', 'Worker started')
    return worker
}
