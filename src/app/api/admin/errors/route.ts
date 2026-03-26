import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { cache } from '@/lib/cache'

// GET — admin: view recent errors and system health
export async function GET() {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const errors = logger.getRecent(100)
    const stats1h = logger.getStats(60)
    const stats24h = logger.getStats(1440)

    return NextResponse.json({
        recentErrors: errors,
        stats: {
            lastHour: stats1h,
            last24Hours: stats24h,
        },
        cache: {
            entries: cache.size,
        },
        uptime: process.uptime(),
        memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    })
}
