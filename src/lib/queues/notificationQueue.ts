/**
 * Notification Queue (BullMQ)
 * ---------------------------------------------------------------------------
 * Handles all outbound notification jobs: email + in-app.
 * Each job is retried up to 3 times with exponential back-off.
 *
 * Redis: set REDIS_URL to your Upstash rediss:// URL in production.
 * Worker: started via src/instrumentation.ts on server boot (Node runtime only).
 *
 * Usage:
 *   import { notificationQueue } from '@/lib/queues/notificationQueue'
 *   await notificationQueue.add('email', payload)
 */
import { Queue, Worker, Job } from 'bullmq'
import { sendEmail } from '@/lib/mailer'
import { logger } from '@/lib/logger'

// ─── Redis connection ────────────────────────────────────────────────────────
// Supports:
//   redis://127.0.0.1:6379            (local dev)
//   rediss://:password@host:port      (Upstash — TLS required)
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const parsedUrl = new URL(redisUrl)
const isTls = redisUrl.startsWith('rediss://')

const connection = {
    host: parsedUrl.hostname,
    port: parseInt(parsedUrl.port || '6379', 10),
    ...(parsedUrl.password ? { password: decodeURIComponent(parsedUrl.password) } : {}),
    ...(isTls ? { tls: {} } : {}),  // Upstash requires TLS
}

// ─── Job payload types ─────────────────────────────────────────────────────
export interface NotificationJobPayload {
    type: 'email' | 'in_app' | 'both'
    userId?: string           // target user (for in-app)
    email?: string            // recipient email address
    subject?: string
    html?: string
    notificationId?: string  // UserNotification row id (for logging)
}

// ─── Queue ─────────────────────────────────────────────────────────────────
export const notificationQueue = new Queue<NotificationJobPayload>('notifications', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 60 * 60 * 24 },       // keep 24 h
        removeOnFail:     { age: 60 * 60 * 24 * 7 },   // keep 7 days on failure
    },
})

// ─── Worker ────────────────────────────────────────────────────────────────
// Started once on server boot via instrumentation.ts (Node runtime only).
// Guards against double-start across hot-reload cycles.
let workerStarted = false

export function startNotificationWorker() {
    if (workerStarted) return
    workerStarted = true

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
