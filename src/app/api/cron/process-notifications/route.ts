/**
 * Vercel Cron Job — Notification Queue Processor
 * -----------------------------------------------
 * Vercel serverless functions don't keep BullMQ workers alive between
 * requests. This cron endpoint bridges the gap:
 *   • Starts the worker
 *   • Lets it drain pending jobs for up to 55 seconds
 *   • Closes gracefully before Vercel kills the function
 *
 * Schedule: every minute (* * * * *)
 * Configured in vercel.json → crons
 *
 * Security: requests must include Authorization: Bearer <CRON_SECRET>
 * Set CRON_SECRET as an environment variable in Vercel.
 */
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export const maxDuration = 60   // Vercel Pro: up to 300 s; Hobby: 60 s

export async function GET(req: NextRequest) {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.REDIS_URL) {
        return NextResponse.json({ skipped: true, reason: 'REDIS_URL not set' })
    }

    const started = Date.now()
    let jobsProcessed = 0

    try {
        const { getNotificationQueue, startNotificationWorker } = await import('@/lib/queues/notificationQueue')

        const queue = getNotificationQueue()
        if (!queue) {
            return NextResponse.json({ skipped: true, reason: 'Queue unavailable' })
        }

        // Check if there are any waiting jobs before spinning up a worker
        const waiting = await queue.getWaitingCount()
        const delayed = await queue.getDelayedCount()
        const total = waiting + delayed

        if (total === 0) {
            return NextResponse.json({ processed: 0, message: 'Queue empty — nothing to do' })
        }

        logger.info('cron/process-notifications', `Found ${total} pending jobs — starting worker`)

        // Start the worker and let it process jobs
        const worker = startNotificationWorker()

        if (!worker) {
            return NextResponse.json({ skipped: true, reason: 'Worker failed to start' })
        }

        // Listen for completions to track count
        worker.on('completed', () => { jobsProcessed++ })

        // Let the worker run for up to 50 seconds (leaving 10s buffer for Vercel teardown)
        const DRAIN_TIME_MS = 50_000
        await new Promise<void>((resolve) => {
            const timeout = setTimeout(resolve, DRAIN_TIME_MS)

            // Early exit: if queue becomes empty, stop waiting
            const checkInterval = setInterval(async () => {
                const remaining = await queue.getWaitingCount().catch(() => 1)
                if (remaining === 0) {
                    clearInterval(checkInterval)
                    clearTimeout(timeout)
                    resolve()
                }
            }, 2_000)
        })

        // Graceful close
        await worker.close()

        const elapsed = Date.now() - started
        logger.info('cron/process-notifications', `Cron run complete — ${jobsProcessed} jobs processed in ${elapsed}ms`)

        return NextResponse.json({
            processed: jobsProcessed,
            elapsed_ms: elapsed,
            message: `Processed ${jobsProcessed} notification jobs`,
        })

    } catch (err) {
        logger.error('cron/process-notifications', 'Cron run failed', { error: err as Error })
        return NextResponse.json({ error: 'Worker error', detail: (err as Error).message }, { status: 500 })
    }
}
