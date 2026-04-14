import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { callGemini } from '@/lib/gemini'
import { LANGUAGE_NAMES } from '@/lib/subtitle-languages'

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
    if (session.role !== 'admin' && session.role !== 'superadmin') {
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

    // Skip languages already translated (checkpoint resume)
    const pending = TARGET_LANGS.filter(l => !existingTranslations[l])

    if (pending.length === 0) {
        return NextResponse.json({ message: 'All languages already translated', status: 'complete' })
    }

    // ── Mark as in-progress ─────────────────────────────────────────
    await prisma.filmSubtitle.update({
        where: { id: subtitle.id },
        data: { translateStatus: 'partial' },
    })

    // ── SSE stream ──────────────────────────────────────────────────
    const encoder = new TextEncoder()
    let completedCount = 0
    let lastKeyLabel = ''

    const stream = new ReadableStream({
        async start(controller) {
            const emit = (data: object) => {
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
                } catch { /* connection closed */ }
            }

            emit({ phase: 'start', total: pending.length, langs: pending })

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

                    // ✅ Checkpoint save — persisted even if stream drops
                    await prisma.filmSubtitle.update({
                        where: { id: subtitle.id },
                        data: {
                            translations: JSON.stringify(existingTranslations),
                            generatedWith: lastKeyLabel,
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
                    // Continue to next language — don't abort the whole job
                }
            }

            // ── Final status update ──────────────────────────────────
            const allLangsDone = TARGET_LANGS.every(l => existingTranslations[l])
            await prisma.filmSubtitle.update({
                where: { id: subtitle.id },
                data: {
                    translateStatus: allLangsDone ? 'complete' : 'partial',
                    status: 'completed',
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
