import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'

/**
 * POST /api/watch/session-end
 *
 * Records playback analytics at the end of a watch session.
 * Called by WatchPlayer via navigator.sendBeacon on video end/unmount.
 *
 * Writes to TWO tables:
 *   FilmView     — analytics (all viewers including anonymous) → populates Content tab
 *   WatchHistory — resume/progress (authenticated users only)
 *
 * Body: {
 *   projectId: string
 *   episodeId?: string
 *   subtitleLang?: string   — ISO 639-1 code, null if captions off
 *   audioLang?: string      — ISO 639-1 code of audio track used
 *   captionsOn: boolean
 *   completePct: number     — 0.0–1.0 fraction watched
 *   watchDurationSec?: number — seconds the user actually watched
 * }
 */
export async function POST(req: NextRequest) {
    // Skip bot traffic (sendBeacon from real browsers always has a real UA)
    const ua = req.headers.get('user-agent') ?? ''
    const isBot = /bot|crawl|spider|headless|phantom|selenium/i.test(ua)
    if (isBot) return NextResponse.json({ ok: true })

    try {
        const body = await req.json() as {
            projectId: string
            episodeId?: string
            subtitleLang?: string
            audioLang?: string
            captionsOn?: boolean
            completePct?: number
            watchDurationSec?: number
        }

        const { projectId, subtitleLang, audioLang, captionsOn = false, completePct, watchDurationSec } = body

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
        }

        // Clamp completePct to [0, 1]
        const safePct = completePct != null
            ? Math.min(1, Math.max(0, Number(completePct.toFixed(4))))
            : null

        // Skip sessions where the user barely started watching (< 3 seconds or < 1%)
        const durationSec = watchDurationSec ?? 0
        const watchedMeaningfully = durationSec >= 3 || (safePct != null && safePct >= 0.01)
        if (!watchedMeaningfully) return NextResponse.json({ ok: true })

        // ── Resolve session (optional — anon views still count) ─────────────────
        const session = await getUserSession()
        const userId = session?.userId ?? null

        // ── 1. FilmView — analytics record (ALL viewers, including anonymous) ───
        // One record per (projectId, userId|null, calendar day) to prevent spam.
        try {
            const startOfDay = new Date()
            startOfDay.setHours(0, 0, 0, 0)

            const existingView = await prisma.filmView.findFirst({
                where: {
                    projectId,
                    ...(userId ? { userId } : { userId: null }),
                    createdAt: { gte: startOfDay },
                },
                select: { id: true },
            })

            if (!existingView) {
                await prisma.filmView.create({
                    data: {
                        projectId,
                        userId,
                        watchDuration: Math.round(durationSec),
                        completed: safePct != null && safePct >= 0.9,
                    },
                })
            } else {
                // Update watch duration on the existing same-day record
                await prisma.filmView.update({
                    where: { id: existingView.id },
                    data: {
                        watchDuration: Math.round(durationSec),
                        completed: safePct != null && safePct >= 0.9,
                    },
                })
            }
        } catch (viewErr) {
            // Non-critical — FilmView errors must not break WatchHistory
            console.error('[watch/session-end] FilmView write error:', viewErr)
        }

        // ── 2. WatchHistory — resume positions (authenticated users only) ───────
        if (userId) {
            const existing = await prisma.watchHistory.findFirst({
                where: { userId, projectId },
                orderBy: { watchedAt: 'desc' },
            })

            if (existing) {
                await prisma.watchHistory.update({
                    where: { id: existing.id },
                    data: {
                        subtitleLang: subtitleLang ?? null,
                        audioLang: audioLang ?? null,
                        captionsOn,
                        completePct: safePct,
                        progress: safePct ?? existing.progress,
                    },
                })
            } else {
                await prisma.watchHistory.create({
                    data: {
                        userId,
                        projectId,
                        subtitleLang: subtitleLang ?? null,
                        audioLang: audioLang ?? null,
                        captionsOn,
                        completePct: safePct,
                        progress: safePct ?? 0,
                    },
                })
            }
        }

        return NextResponse.json({ ok: true })
    } catch (err) {
        // Never fail a beacon — return 200 even on error to prevent retry storms
        console.error('[watch/session-end] Error:', err)
        return NextResponse.json({ ok: true })
    }
}
