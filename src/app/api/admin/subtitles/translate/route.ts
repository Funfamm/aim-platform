import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { hasAdminRole } from '@/lib/roles'
import { SUBTITLE_TARGET_LANGS, LANGUAGE_NAMES } from '@/config/subtitles'
import { translateTextsForLang, buildTranslatedSegments } from '@/lib/subtitle-service'
import { cacheVttToR2 } from '@/lib/vtt-storage'
import { SSE_ERR } from '@/lib/sse-errors'
import { findSubtitle } from '@/lib/subtitle-repo'
import {
    markLangsProcessing,
    checkpointLang,
    failLang,
    finalizeTranslation,
} from '@/lib/subtitle-status-service'

// Vercel Pro: allows this SSE route to stream for up to 5 minutes
export const maxDuration = 300

/**
 * POST /api/admin/subtitles/translate
 *
 * Translates all subtitle languages for a given project via SSE.
 * Streams one event per language, checkpointing each to DB immediately
 * so progress survives a dropped connection.
 *
 * Body: { projectId: string, episodeId?: string }
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

    const { projectId, episodeId } = await req.json()
    if (!projectId) {
        return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    // ── Load subtitle record via repository ────────────────────────────────
    const subtitle = await findSubtitle(projectId, episodeId)
    if (!subtitle) {
        return NextResponse.json(
            { error: 'No transcription found for this project. Run transcription first.' },
            { status: SSE_ERR.NOT_FOUND }
        )
    }

    // ── Parse source segments ──────────────────────────────────────────────
    let sourceSegments: { start: number; end: number; text: string }[] = []
    try {
        sourceSegments = JSON.parse(subtitle.segments)
    } catch {
        return NextResponse.json({ error: 'Failed to parse subtitle segments' }, { status: SSE_ERR.PARSE_FAILED })
    }

    const existingTranslations: Record<string, { start: number; end: number; text: string }[]> =
        subtitle.translations ? JSON.parse(subtitle.translations) : {}

    const existingLangStatus = (subtitle.langStatus as Record<string, string> | null) ?? {}
    const existingVttPaths   = (subtitle.vttPaths  as Record<string, string> | null) ?? {}

    // ── Rate-limit: reject if a job is already running ─────────────────────
    const alreadyProcessing = Object.values(existingLangStatus).some(s => s === 'processing')
    if (alreadyProcessing) {
        return NextResponse.json(
            {
                error: 'A translation job is already running for this project. Please wait.',
                code: SSE_ERR.RATE_LIMITED,
            },
            { status: SSE_ERR.RATE_LIMITED }
        )
    }

    // ── Determine which languages still need translating ───────────────────
    // Read the source language Whisper detected. Falls back to 'en' for older
    // records that were saved before originalLanguage was written.
    const sourceLang = (subtitle.originalLanguage as string | null) ?? 'en'

    // Build the full ordered target list:
    // 1. If source is non-English, insert 'en' first so English viewers always get subtitles
    // 2. Include all standard targets EXCEPT the source language (no self-translation)
    const allTargets: string[] = [
        ...(sourceLang !== 'en' && !existingTranslations['en'] ? ['en'] : []),
        ...SUBTITLE_TARGET_LANGS.filter(l => l !== sourceLang),
    ]
    const pending = allTargets.filter(l => !existingTranslations[l])
    if (pending.length === 0) {
        return NextResponse.json({ message: 'All languages already translated', status: 'complete' })
    }

    // ── Optimistically mark pending langs as 'processing' ──────────────────
    const processingStatus = await markLangsProcessing(subtitle.id, [...pending], existingLangStatus)

    // ── SSE stream ─────────────────────────────────────────────────────────
    const encoder = new TextEncoder()
    let completedCount = 0
    let lastKeyLabel   = ''
    const langStatus   = { ...processingStatus }
    const vttPaths     = { ...existingVttPaths }

    const stream = new ReadableStream({
        async start(controller) {
            const emit = (data: object) => {
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
                } catch { /* connection already closed */ }
            }

            emit({ phase: 'start', total: pending.length, langs: [...pending] })

            // 30-second SSE heartbeat — prevents proxy/Vercel timeout
            const heartbeat = setInterval(() => emit({ phase: 'heartbeat', ts: Date.now() }), 30_000)

            for (const lang of pending) {
                const langName = LANGUAGE_NAMES[lang] ?? lang
                emit({ lang, langName, phase: 'translating', pct: Math.round((completedCount / pending.length) * 100) })

                try {
                    const texts = sourceSegments.map(s => s.text)

                    // ISP Fix: destructure result instead of mutating keyLabelOut
                    const { translations: translatedTexts, keyLabel } = await translateTextsForLang(texts, lang, sourceLang)
                    if (keyLabel) lastKeyLabel = keyLabel

                    const translatedSegments = buildTranslatedSegments(sourceSegments, translatedTexts)
                    existingTranslations[lang] = translatedSegments
                    completedCount++

                    // Cache VTT to R2 — errors are non-fatal
                    try {
                        vttPaths[lang] = await cacheVttToR2(projectId, lang, translatedSegments)
                    } catch (vttErr) {
                        console.error(`[translate] VTT cache failed for ${lang}:`, vttErr)
                    }

                    langStatus[lang] = 'completed'

                    // ✅ Checkpoint — persisted even if stream drops
                    await checkpointLang(
                        subtitle.id,
                        lang,
                        JSON.stringify(existingTranslations),
                        langStatus,
                        vttPaths,
                        lastKeyLabel,
                    )

                    emit({
                        lang, langName, phase: 'done',
                        pct: Math.round((completedCount / pending.length) * 100),
                    })

                } catch (err) {
                    const errMsg = err instanceof Error ? err.message : 'Unknown error'
                    langStatus[lang] = 'failed'
                    emit({ lang, langName, phase: 'error', error: errMsg, code: SSE_ERR.TRANSLATE_FAILED })
                    await failLang(subtitle.id, lang, langStatus)
                    // Continue to next language — don't abort the whole job
                }
            }

            clearInterval(heartbeat)

            // ── Final status update ────────────────────────────────────────
            // Use allTargets (which includes 'en' for non-English sources) so
            // a Korean film's completion status is only 'complete' once every
            // required language — including English — is translated.
            const allDone = allTargets.every(l => existingTranslations[l])
            await finalizeTranslation(
                subtitle.id,
                allDone ? 'complete' : 'partial',
                langStatus,
                vttPaths,
            )

            emit({
                phase: 'complete',
                completed: completedCount,
                total: pending.length,
                allDone,
                generatedWith: lastKeyLabel,
            })

            controller.close()
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // disable Nginx buffering for SSE
        },
    })
}
