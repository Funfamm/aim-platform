import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { hasAdminRole } from '@/lib/roles'
import { SUBTITLE_TARGET_LANGS, LANGUAGE_NAMES } from '@/config/subtitles'
import { translateTextsForLang, buildTranslatedSegments, type Segment } from '@/lib/subtitle-service'
import { cacheVttToR2 } from '@/lib/vtt-storage'
import { findSubtitle } from '@/lib/subtitle-repo'
import { markLangsProcessing, failLang, finalizeSingleLang } from '@/lib/subtitle-status-service'
import { SSE_ERR } from '@/lib/sse-errors'

/**
 * POST /api/admin/subtitles/retry-lang
 *
 * Re-translates a single language for a given project/episode via SSE.
 * Uses the same SSE event shape as /translate so the client can reuse handlers.
 *
 * Body: { projectId: string, episodeId?: string, lang: string }
 * Response: text/event-stream
 */
export async function POST(req: NextRequest) {
    // ── Auth guard ─────────────────────────────────────────────────────────
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

    // ── Load subtitle record via repository ────────────────────────────────
    const subtitle = await findSubtitle(projectId, episodeId)
    if (!subtitle) {
        return NextResponse.json(
            { error: 'No subtitle record found for this project', code: SSE_ERR.NOT_FOUND },
            { status: SSE_ERR.NOT_FOUND }
        )
    }

    // ── Parse source data ──────────────────────────────────────────────────
    const sourceLang = (subtitle.originalLanguage as string | null) ?? 'en'
    let sourceSegments: Segment[] = []
    try {
        sourceSegments = JSON.parse(subtitle.segments)
    } catch {
        return NextResponse.json(
            { error: 'Failed to parse subtitle segments', code: SSE_ERR.PARSE_FAILED },
            { status: SSE_ERR.PARSE_FAILED }
        )
    }

    const existingTranslations: Record<string, Segment[]> =
        subtitle.translations ? JSON.parse(subtitle.translations) : {}

    const existingLangStatus = (subtitle.langStatus as Record<string, string> | null) ?? {}
    const existingVttPaths   = (subtitle.vttPaths  as Record<string, string> | null) ?? {}

    // ── Mark as processing ─────────────────────────────────────────────────
    await markLangsProcessing(subtitle.id, [lang], existingLangStatus)

    // ── SSE stream ─────────────────────────────────────────────────────────
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
        async start(controller) {
            const emit = (data: object) => {
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
                } catch { /* connection closed */ }
            }

            const langName = LANGUAGE_NAMES[lang] ?? lang
            emit({ lang, langName, phase: 'translating', pct: 0 })

            try {
                const texts = sourceSegments.map(s => s.text)

                // ISP Fix: destructure result instead of mutating keyLabelOut
                const { translations: translatedTexts } = await translateTextsForLang(texts, lang, sourceLang)
                emit({ lang, langName, phase: 'translating', pct: 85 })

                const translatedSegments = buildTranslatedSegments(sourceSegments, translatedTexts)
                existingTranslations[lang] = translatedSegments

                // Cache VTT to R2 — non-fatal
                try {
                    existingVttPaths[lang] = await cacheVttToR2(projectId, lang, translatedSegments)
                    emit({ lang, langName, phase: 'translating', pct: 95 })
                } catch (e) {
                    console.error('[retry-lang] VTT cache failed:', e)
                }

                // Compute allTargets same way as translate/route.ts
                const allTargets = [
                    ...(sourceLang !== 'en' && !existingTranslations['en'] ? ['en'] : []),
                    ...SUBTITLE_TARGET_LANGS.filter(l => l !== sourceLang),
                ]
                // Persist result via status service
                const allDone = allTargets.every(l => !!existingTranslations[l])
                await finalizeSingleLang(
                    subtitle.id,
                    lang,
                    JSON.stringify(existingTranslations),
                    existingLangStatus,
                    existingVttPaths,
                    allDone ? 'complete' : 'partial',
                )

                emit({ lang, langName, phase: 'done', pct: 100 })

            } catch (err) {
                const errMsg = err instanceof Error ? err.message : 'Unknown error'
                emit({ lang, langName, phase: 'error', error: errMsg, code: SSE_ERR.TRANSLATE_FAILED })
                await failLang(subtitle.id, lang, existingLangStatus)
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
