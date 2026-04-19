/**
 * GET /api/cron/cleanup-subtitles
 *
 * Vercel cron job — runs every hour.
 * Marks subtitle jobs that have been stuck in 'queued' or 'processing'
 * for more than 2 hours as 'failed'.
 *
 * SECURITY: Uses CRON_SECRET to authenticate Vercel's cron caller.
 */

import { NextRequest, NextResponse } from 'next/server'
import { cleanupStuckJobs } from '@/lib/subtitle-job-service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // Require CRON_SECRET unless running locally (no secret set)
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const count = await cleanupStuckJobs(2 * 60 * 60 * 1000) // 2-hour threshold
        console.info(`[cron/cleanup-subtitles] Marked ${count} stuck subtitle job(s) as failed.`)
        return NextResponse.json({ cleaned: count, timestamp: new Date().toISOString() })
    } catch (err) {
        console.error('[cron/cleanup-subtitles] Error during cleanup:', err)
        return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 })
    }
}
