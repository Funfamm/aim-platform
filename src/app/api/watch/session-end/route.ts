import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'

/**
 * POST /api/watch/session-end
 *
 * Records playback analytics at the end of a watch session.
 * Called by WatchPlayer via navigator.sendBeacon on video end/unmount.
 *
 * Body: {
 *   projectId: string
 *   episodeId?: string
 *   subtitleLang?: string   — ISO 639-1 code, null if captions off
 *   audioLang?: string      — ISO 639-1 code of audio track used
 *   captionsOn: boolean
 *   completePct: number     — 0.0–1.0 fraction watched
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
        }

        const { projectId, subtitleLang, audioLang, captionsOn = false, completePct } = body

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
        }

        // Clamp completePct to [0, 1]
        const safePct = completePct != null
            ? Math.min(1, Math.max(0, Number(completePct.toFixed(4))))
            : null

        // Only update if user is authenticated — anonymous sessions aren't tracked
        const session = await getUserSession()
        if (!session?.userId) {
            return NextResponse.json({ ok: true }) // silent pass — don't error on anon
        }

        // Upsert: update latest row, or create if missing (in case page-load watch create failed)
        const existing = await prisma.watchHistory.findFirst({
            where: { userId: session.userId, projectId },
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
                    userId: session.userId,
                    projectId,
                    subtitleLang: subtitleLang ?? null,
                    audioLang: audioLang ?? null,
                    captionsOn,
                    completePct: safePct,
                    progress: safePct ?? 0,
                },
            })
        }

        return NextResponse.json({ ok: true })
    } catch (err) {
        // Never fail a beacon — return 200 even on error to prevent browser retry storms
        console.error('[watch/session-end] Error:', err)
        return NextResponse.json({ ok: true })
    }
}
