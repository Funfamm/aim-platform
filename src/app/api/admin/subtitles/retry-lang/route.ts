import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { hasAdminRole } from '@/lib/roles'
import { callGemini } from '@/lib/gemini'
import { LANGUAGE_NAMES } from '@/lib/subtitle-languages'
import { cacheVttToR2 } from '@/lib/vtt-storage'

/**
 * POST /api/admin/subtitles/retry-lang
 *
 * Re-translates a single language for a given project/episode.
 * Uses the same SSE event shape as the full /translate endpoint
 * so the client can reuse the same handler.
 *
 * Body: { projectId: string, episodeId?: string, lang: string }
 */
export async function POST(req: NextRequest) {
    const session = await getUserSession()
    if (!session?.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!hasAdminRole(session.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { projectId, episodeId, lang } = await req.json() as {
        projectId: string
        episodeId?: string
        lang: string
    }

    if (!projectId || !lang) {
        return NextResponse.json({ error: 'projectId and lang are required' }, { status: 400 })
    }

    const subtitle = await prisma.filmSubtitle.findFirst({
        where: { projectId, episodeId: episodeId || null },
    })

    if (!subtitle) {
        return NextResponse.json({ error: 'No subtitle record found for this project' }, { status: 404 })
    }

    let englishSegments: { start: number; end: number; text: string }[] = []
    try {
        englishSegments = JSON.parse(subtitle.segments)
    } catch {
        return NextResponse.json({ error: 'Failed to parse subtitle segments' }, { status: 500 })
    }

    const existingTranslations: Record<string, { start: number; end: number; text: string }[]> =
        subtitle.translations ? JSON.parse(subtitle.translations) : {}

    const existingLangStatus = (subtitle.langStatus as Record<string, string> | null) ?? {}
    const existingVttPaths = (subtitle.vttPaths as Record<string, string> | null) ?? {}

    // ── SSE stream ──────────────────────────────────────────────────────────
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
        async start(controller) {
            const emit = (data: object) => {
                try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch { /* closed */ }
            }

            const langName = LANGUAGE_NAMES[lang] || lang
            emit({ lang, langName, phase: 'translating', pct: 0 })

            // Mark as processing — prevent concurrent retries on same lang
            await prisma.filmSubtitle.update({
                where: { id: subtitle.id },
                data: {
                    langStatus: { ...existingLangStatus, [lang]: 'processing' },
                },
            })

            try {
                const texts = englishSegments.map(s => s.text)
                const MAX_PER_CALL = 500
                const translatedTexts: string[] = []

                for (let i = 0; i < texts.length; i += MAX_PER_CALL) {
                    const chunk = texts.slice(i, i + MAX_PER_CALL)
                    const prompt = [
                        `You are a professional subtitle translator for a film platform.`,
                        `Translate the following ${chunk.length} subtitle lines to ${langName} (code: ${lang}).`,
                        `Return ONLY a JSON array of exactly ${chunk.length} translated strings, same order.`,
                        `Preserve names, technical terms, and cinematic register. No extra text outside the JSON.`,
                        `Input:`,
                        JSON.stringify(chunk),
                    ].join('\n')

                    const result = await callGemini(prompt, 'subtitles')
                    if ('error' in result) throw new Error(result.error)

                    const jsonMatch = result.text.match(/\[[\s\S]*\]/)
                    if (!jsonMatch) throw new Error('No JSON array in Gemini response')
                    const parsed: string[] = JSON.parse(jsonMatch[0])
                    while (parsed.length < chunk.length) parsed.push('')
                    translatedTexts.push(...parsed)

                    emit({ lang, langName, phase: 'translating', pct: Math.round(((i + chunk.length) / texts.length) * 80) })
                }

                const translatedSegments = englishSegments.map((seg, i) => ({
                    start: seg.start,
                    end: seg.end,
                    text: translatedTexts[i] || seg.text,
                }))

                existingTranslations[lang] = translatedSegments

                // Cache VTT to R2
                let newVttKey: string | null = null
                try {
                    newVttKey = await cacheVttToR2(projectId, lang, translatedSegments)
                    existingVttPaths[lang] = newVttKey
                    emit({ lang, langName, phase: 'translating', pct: 95 })
                } catch (e) {
                    console.error('[retry-lang] VTT cache failed:', e)
                }

                const allDone = ['es', 'fr', 'de', 'pt', 'ru', 'zh', 'ar', 'ja', 'ko', 'hi'].every(
                    l => existingTranslations[l]
                )

                await prisma.filmSubtitle.update({
                    where: { id: subtitle.id },
                    data: {
                        translations: JSON.stringify(existingTranslations),
                        langStatus: { ...existingLangStatus, [lang]: 'completed' },
                        vttPaths: existingVttPaths,
                        translateStatus: allDone ? 'complete' : 'partial',
                    },
                })

                emit({ lang, langName, phase: 'done', pct: 100 })

            } catch (err) {
                const errMsg = err instanceof Error ? err.message : 'Unknown error'
                emit({ lang, langName, phase: 'error', error: errMsg })
                await prisma.filmSubtitle.update({
                    where: { id: subtitle.id },
                    data: { langStatus: { ...existingLangStatus, [lang]: 'failed' } },
                })
            }

            emit({ phase: 'complete', lang })
            controller.close()
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    })
}
