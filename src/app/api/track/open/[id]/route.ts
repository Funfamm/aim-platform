import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calcBotScore } from '@/lib/botScore'

// 1x1 transparent GIF (43 bytes)
const PIXEL = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
)

/**
 * GET /api/track/open/[id]
 * Tracking pixel endpoint — marks an EmailLog as opened.
 * Returns a 1x1 transparent GIF with aggressive no-cache headers.
 * Analytics are best-effort: failures never produce visible errors.
 *
 * On first open, also rescores the subscriber's botScore.
 * Opening an email is strong evidence of a real human — score drops significantly.
 * Score is updated whenever it changes (up or down) to keep DB in sync.
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: trackingId } = await params

    if (trackingId) {
        // Mark email as opened (only on first open)
        prisma.emailLog.updateMany({
            where: { trackingId, openedAt: null },
            data: { openedAt: new Date() },
        }).then(async (result) => {
            // Only rescore if this was actually the first open (affected 1 row)
            if (result.count === 0) return

            try {
                // Look up subscriber email from the EmailLog
                const log = await prisma.emailLog.findFirst({
                    where: { trackingId },
                    select: { to: true },
                })
                if (!log) return

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const db = prisma as any
                const sub = await db.subscriber.findFirst({
                    where: { email: { equals: log.to, mode: 'insensitive' } },
                    select: { email: true, name: true, country: true, botScore: true },
                })
                if (!sub) return

                // Signup velocity: how many subscribers from same country
                const velocity = sub.country
                    ? await db.subscriber.count({ where: { country: sub.country } })
                    : 0

                // hasOpened=true — this is the point where that flips for this subscriber
                const { score: newScore } = calcBotScore(sub, true, velocity)

                // Update whenever score changed (up or down) — not just decreases
                if (newScore !== sub.botScore) {
                    await db.subscriber.updateMany({
                        where: { email: { equals: log.to, mode: 'insensitive' } },
                        data: { botScore: newScore },
                    })
                    console.log(`[track/open] Rescored ${log.to}: ${sub.botScore} → ${newScore}`)
                }
            } catch (err) {
                // Non-critical — never surface errors from tracking pixel
                console.error('[track/open] Rescore error:', err)
            }
        }).catch(() => { /* non-critical */ })
    }

    return new NextResponse(PIXEL, {
        status: 200,
        headers: {
            'Content-Type': 'image/gif',
            'Content-Length': String(PIXEL.length),
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        },
    })
}
