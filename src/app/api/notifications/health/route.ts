/**
 * Notification Queue Health Check
 * --------------------------------
 * Returns current queue depths and Redis connectivity status.
 * Useful for monitoring dashboards and CI health gates.
 *
 * GET /api/notifications/health
 * Secured: requires admin JWT or CRON_SECRET header in production.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
    // Allow requests with CRON_SECRET OR a logged-in admin user
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    let authorized = false
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
        authorized = true
    } else {
        try {
            const user = await getAuthUser(req)
            if (user?.role === 'admin' || user?.role === 'superadmin') authorized = true
        } catch { /* not logged in */ }
    }

    if (!authorized) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.REDIS_URL) {
        return NextResponse.json({
            status: 'degraded',
            reason: 'REDIS_URL not set — queue disabled',
            queue: null,
        })
    }

    try {
        const { getNotificationQueue, getFailedNotificationsQueue } = await import('@/lib/queues/notificationQueue')

        const queue = getNotificationQueue()
        const dlq   = getFailedNotificationsQueue()

        if (!queue) {
            return NextResponse.json({ status: 'degraded', reason: 'Queue unavailable' })
        }

        const [waiting, active, delayed, failed, completed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getDelayedCount(),
            queue.getFailedCount(),
            queue.getCompletedCount(),
        ])

        const dlqFailed = dlq ? await dlq.getWaitingCount() : 0

        const status = failed > 10
            ? 'warning'
            : dlqFailed > 0
                ? 'warning'
                : 'healthy'

        return NextResponse.json({
            status,
            queue: {
                waiting,
                active,
                delayed,
                failed,
                completed,
            },
            dlq: {
                count: dlqFailed,
            },
            timestamp: new Date().toISOString(),
        })
    } catch (err) {
        return NextResponse.json({
            status: 'error',
            reason: (err as Error).message,
        }, { status: 500 })
    }
}
