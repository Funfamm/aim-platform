import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { hasAdminRole } from '@/lib/roles'
import { SUBTITLE_TARGET_LANGS, LANGUAGE_NAMES } from '@/lib/subtitle-languages'
import { translateTextsForLang, buildTranslatedSegments, type Segment } from '@/lib/subtitle-service'
import { cacheVttToR2 } from '@/lib/vtt-storage'
import { findSubtitle, failLang, finalizeSingleLang } from '@/lib/subtitle-repo'

// SSE numeric error codes — mirrors translate/route.ts for consistency
const ERR = {
    NOT_FOUND: 404,
    PARSE_FAILED: 500,
    TRANSLATE_FAILED: 502,
} as const

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
            { error: 'No subtitle record found for this project', code: ERR.NOT_FOUND },
            { status: ERR.NOT_FOUND }
        )
    }

    // ── Parse source data ──────────────────────────────────────────────────
    let englishSegments: Segment[] = []
    try {
        englishSegments = JSON.parse(subtitle.segments)
    } catch {
        return NextResponse.json(
            { error: 'Failed to parse subtitle segments', code: ERR.PARSE_FAILED },
            { status: ERR.PARSE_FAILED }
        )
    }

    const existingTranslations: Record<string, Segment[]> =
        subtitle.translations ? JSON.parse(subtitle.translations) : {}

    const existingLangStatus = (subtitle.langStatus as Record<string, string> | null) ?? {}
    const existingVttPaths   = (subtitle.vttPaths  as Record<string, string> | null) ?? {}

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

            // Mark as processing — prevent concurrent retries on the same lang
            await import('@/lib/subtitle-repo').then(r =>
                r.markLangsProcessing(subtitle.id, [lang], existingLangStatus)
            )

            try {
                const texts       = englishSegments.map(s => s.text)
                const keyLabelOut = { value: '' }

                const translatedTexts = await translateTextsForLang(texts, lang, keyLabelOut)
                emit({ lang, langName, phase: 'translating', pct: 85 })

                const translatedSegments = buildTranslatedSegments(englishSegments, translatedTexts)
                existingTranslations[lang] = translatedSegments

                // Cache VTT to R2 — non-fatal
                try {
                    existingVttPaths[lang] = await cacheVttToR2(projectId, lang, translatedSegments)
                    emit({ lang, langName, phase: 'translating', pct: 95 })
                } catch (e) {
                    console.error('[retry-lang] VTT cache failed:', e)
                }

                // Persist result via repository
                await finalizeSingleLang(
                    subtitle.id,
                    lang,
                    JSON.stringify(existingTranslations),
                    existingLangStatus,
                    existingVttPaths,
                    SUBTITLE_TARGET_LANGS,
                    existingTranslations,
                )

                emit({ lang, langName, phase: 'done', pct: 100 })

            } catch (err) {
                const errMsg = err instanceof Error ? err.message : 'Unknown error'
                emit({ lang, langName, phase: 'error', error: errMsg, code: ERR.TRANSLATE_FAILED })
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
