/**
 * GET /api/cron/delete-high-bot-subscribers
 * ------------------------------------------------------------------
 * Nightly cron that permanently removes subscribers with botScore >= threshold
 * (default 80, configurable via AUTO_DELETE_BOT_SCORE env var).
 *
 * Protected by CRON_SECRET header — same pattern as all other crons.
 * Schedule: 0 2 * * *  (02:00 UTC every night)
 */
import { NextRequest, NextResponse } from 'next/server'
import { autoDeleteHighRiskBots, getBotDeleteThreshold } from '@/lib/botCleanup'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
    // ── Auth: CRON_SECRET ──────────────────────────────────────────
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
        const auth = request.headers.get('authorization')
        if (auth !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
    }

    try {
        const threshold = getBotDeleteThreshold()
        const result = await autoDeleteHighRiskBots(threshold, 'auto_cron')

        return NextResponse.json({
            status: 'ok',
            threshold,
            ...result,
        })
    } catch (err) {
        logger.error('cron/delete-high-bot-subscribers', 'Failed', { error: err as Error })
        return NextResponse.json({ error: 'Internal error', detail: String(err) }, { status: 500 })
    }
}
