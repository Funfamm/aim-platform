import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { hasAdminRole } from '@/lib/roles'
import { callGemini } from '@/lib/gemini'
import { LANGUAGE_NAMES } from '@/lib/subtitle-languages'
import { cacheVttToR2 } from '@/lib/vtt-storage'

// Vercel Pro: allows this SSE route to stream for up to 5 minutes
export const maxDuration = 300

// All subtitle languages (English is the source — not translated)
const TARGET_LANGS = ['es', 'fr', 'de', 'pt', 'ru', 'zh', 'ar', 'ja', 'ko', 'hi']

// Rec 4: Max segments per Gemini call — keeps prompts under Groq 128K fallback limit.
// 90-min films may have 800+ segments; chunking prevents token overflow on fallback providers.
const MAX_SEGMENTS_PER_CALL = 500

/**
 * Translate all subtitle texts for one language.
 * Automatically chunks large films into batches of MAX_SEGMENTS_PER_CALL
 * to stay within token limits for any provider in the callGemini rotation.
 */
async function translateTextsForLang(
    texts: string[],
    langCode: string,
    keyLabelOut: { value: string }
): Promise<string[]> {
    if (texts.length <= MAX_SEGMENTS_PER_CALL) {
        return translateChunk(texts, langCode, keyLabelOut)
    }

    // Split into chunks, translate each, merge
    const results: string[] = []
    for (let i = 0; i < texts.length; i += MAX_SEGMENTS_PER_CALL) {
        const chunk = texts.slice(i, i + MAX_SEGMENTS_PER_CALL)
        const translated = await translateChunk(chunk, langCode, keyLabelOut)
        results.push(...translated)
    }
    return results
}

async function translateChunk(
    texts: string[],
    langCode: string,
    keyLabelOut: { value: string }
): Promise<string[]> {
    const langName = LANGUAGE_NAMES[langCode] || langCode
    const prompt = [
        `You are a professional subtitle translator for a film platform.`,
        `Translate the following ${texts.length} English subtitle lines to ${langName} (language code: ${langCode}).`,
        `Rules:`,
        `- Return ONLY a JSON array of strings with exactly ${texts.length} elements`,
        `- One translated string per input line, in the exact same order`,
        `- Preserve character names, technical terms, and proper nouns`,
        `- Match the cinematic tone and register of the original`,
        `- Do NOT add explanations, notes, or any text outside the JSON array`,
        ``,
        `Input lines:`,
        JSON.stringify(texts),
    ].join('\n')

    const result = await callGemini(prompt, 'subtitles')
    if ('error' in result) throw new Error(result.error)
    keyLabelOut.value = result.keyLabel

    const jsonMatch = result.text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array in Gemini response')

    const parsed: string[] = JSON.parse(jsonMatch[0])
    // Pad with empty strings if response is shorter than expected
    while (parsed.length < texts.length) parsed.push('')
    return parsed
}

// POST /api/admin/subtitles/translate
// Body: { projectId: string, episodeId?: string }
// Response: text/event-stream — emits progress per language, saves each to DB immediately
export async function POST(req: NextRequest) {
    // ── Auth guard ──────────────────────────────────────────────────
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

    // ── Load subtitle record ────────────────────────────────────────
    const subtitle = await prisma.filmSubtitle.findFirst({
        where: { projectId, episodeId: episodeId || null },
    })

    if (!subtitle) {
        return NextResponse.json(
            { error: 'No transcription found for this project. Run transcription first.' },
            { status: 404 }
        )
    }

    // ── Parse existing data ─────────────────────────────────────────
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

    // Rate-limit: reject if any language is already in 'processing' state
    const alreadyProcessing = Object.values(existingLangStatus).some(s => s === 'processing')
    if (alreadyProcessing) {
        return NextResponse.json(
            { error: 'A translation job is already running for this project. Please wait for it to complete.' },
            { status: 409 }
        )
    }

    // Skip languages already translated (checkpoint resume)
    const pending = TARGET_LANGS.filter(l => !existingTranslations[l])

    if (pending.length === 0) {
        return NextResponse.json({ message: 'All languages already translated', status: 'complete' })
    }

    // ── Mark all pending langs as 'processing' ──────────────────────────────
    const processingStatus = {
        ...existingLangStatus,
        ...Object.fromEntries(pending.map(l => [l, 'processing'])),
    }
    await prisma.filmSubtitle.update({
        where: { id: subtitle.id },
        data: { translateStatus: 'partial', langStatus: processingStatus },
    })

    // ── SSE stream ──────────────────────────────────────────────────
    const encoder = new TextEncoder()
    let completedCount = 0
    let lastKeyLabel = ''
    const langStatus = { ...processingStatus }
    const vttPaths = { ...existingVttPaths }

    const stream = new ReadableStream({
        async start(controller) {
            const emit = (data: object) => {
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
                } catch { /* connection closed */ }
            }

            emit({ phase: 'start', total: pending.length, langs: pending })

            // ── 30-second heartbeat — prevents proxy/Vercel timeout ──────────
            const heartbeatInterval = setInterval(() => {
                emit({ phase: 'heartbeat', ts: Date.now() })
            }, 30_000)

            for (const lang of pending) {
                const langName = LANGUAGE_NAMES[lang] || lang
                const pct = Math.round((completedCount / pending.length) * 100)
                emit({ lang, langName, phase: 'translating', pct })

                try {
                    const texts = englishSegments.map(s => s.text)
                    const keyLabelOut = { value: '' }

                    // translateTextsForLang automatically chunks >500-segment films
                    const translatedTexts = await translateTextsForLang(texts, lang, keyLabelOut)
                    lastKeyLabel = keyLabelOut.value

                    // Map translations back onto original segments (preserving timestamps)
                    const translatedSegments = englishSegments.map((seg, i) => ({
                        start: seg.start,
                        end: seg.end,
                        text: translatedTexts[i] || seg.text, // fallback to English if empty
                    }))

                    existingTranslations[lang] = translatedSegments
                    completedCount++

                    // Cache VTT to R2 — errors are non-fatal
                    try {
                        const vttKey = await cacheVttToR2(projectId, lang, translatedSegments)
                        vttPaths[lang] = vttKey
                    } catch (vttErr) {
                        console.error(`[translate] VTT cache failed for ${lang}:`, vttErr)
                    }

                    langStatus[lang] = 'completed'

                    // ✅ Checkpoint save — persisted even if stream drops
                    await prisma.filmSubtitle.update({
                        where: { id: subtitle.id },
                        data: {
                            translations: JSON.stringify(existingTranslations),
                            generatedWith: lastKeyLabel,
                            langStatus,
                            vttPaths,
                        },
                    })

                    emit({
                        lang,
                        langName,
                        phase: 'done',
                        pct: Math.round((completedCount / pending.length) * 100),
                    })

                } catch (err) {
                    const errMsg = err instanceof Error ? err.message : 'Unknown error'
                    emit({ lang, langName, phase: 'error', error: errMsg })
                    langStatus[lang] = 'failed'
                    await prisma.filmSubtitle.update({
                        where: { id: subtitle.id },
                        data: { langStatus },
                    })
                    // Continue to next language — don't abort the whole job
                }
            }

            clearInterval(heartbeatInterval)

            // ── Final status update ──────────────────────────────────
            const allLangsDone = TARGET_LANGS.every(l => existingTranslations[l])
            await prisma.filmSubtitle.update({
                where: { id: subtitle.id },
                data: {
                    translateStatus: allLangsDone ? 'complete' : 'partial',
                    status: 'completed',
                    langStatus,
                    vttPaths,
                },
            })

            emit({
                phase: 'complete',
                completed: completedCount,
                total: pending.length,
                allDone: allLangsDone,
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
