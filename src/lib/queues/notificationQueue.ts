/**
 * Notification Queue (BullMQ)
 * ---------------------------------------------------------------------------
 * Handles all outbound notification jobs: email + in-app.
 * Each job is retried up to 3 times with exponential back-off.
 *
 * Usage:
 *   import { notificationQueue } from '@/lib/queues/notificationQueue'
 *   await notificationQueue.add('email', payload)
 */
import { Queue, Worker, Job } from 'bullmq'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/mailer'
import { logger } from '@/lib/logger'

// ─── Redis connection ────────────────────────────────────────────────────────
// BullMQ requires Redis. On Render, set REDIS_URL env var.
// Falls back to local Redis for development.
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const [, , hostPort] = redisUrl.replace('redis://', '').split('@').reverse()
const [host = '127.0.0.1', portStr = '6379'] = (hostPort || redisUrl.replace('redis://', '')).split(':')
const port = parseInt(portStr, 10)
const password = redisUrl.includes('@') ? redisUrl.split(':')[2]?.split('@')[0] : undefined

const connection = { host, port, ...(password ? { password } : {}) }

// ─── Job payload types ────────────────────────────────────────────────────────
export interface NotificationJobPayload {
    type: 'email' | 'in_app' | 'both'
    userId?: string          // target user (for in-app)
    email?: string           // recipient email address
    subject?: string
    html?: string
    notificationId?: string  // UserNotification row to mark sent/failed
}

// ─── Queue definition ─────────────────────────────────────────────────────────
export const notificationQueue = new Queue<NotificationJobPayload>('notifications', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 60 * 60 * 24 }, // keep 24h
        removeOnFail: { age: 60 * 60 * 24 * 7 }, // keep 7 days on failure
    },
})

// ─── Worker (processes jobs when running in Node, not in Next.js edge runtime) ─
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

            // Mark in-app notification as "delivered" if we have its id
            if (notificationId) {
                // Optionally update a `delivered` field; currently just log
                logger.info('notificationQueue', `Job ${job.id} processed notificationId=${notificationId}`)
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

    return worker
}
