/**
 * subtitle-service.ts — Shared server-side translation service.
 *
 * Encapsulates the Gemini translation pipeline: chunking, prompt building,
 * response parsing, and segment reconstruction.
 *
 * Previously this logic was duplicated verbatim in both
 * /api/admin/subtitles/translate/route.ts and
 * /api/admin/subtitles/retry-lang/route.ts.
 *
 * Now both routes import from here (SRP + DRY satisfied).
 */

import { callGemini } from '@/lib/gemini'
import { LANGUAGE_NAMES } from '@/lib/subtitle-languages'

export type Segment = { start: number; end: number; text: string }

/** Maximum subtitle lines per Gemini call — keeps prompts within token limits. */
const MAX_SEGMENTS_PER_CALL = 500

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Translate a single chunk of text lines via Gemini.
 * Returns translated lines in the same order as the input.
 * Pads with empty strings if the model returns fewer items than expected.
 *
 * @param keyLabelOut - Mutable reference that receives the API key label used.
 */
async function translateChunk(
    texts: string[],
    langCode: string,
    keyLabelOut: { value: string },
): Promise<string[]> {
    const langName = LANGUAGE_NAMES[langCode] ?? langCode
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
    // Pad to expected length if model returns shorter array
    while (parsed.length < texts.length) parsed.push('')
    return parsed
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Translate all texts for a single language, automatically chunking large films.
 * Returns the translated lines.
 *
 * @param texts        - Raw source text lines (one per subtitle segment)
 * @param langCode     - ISO 639-1 language code to translate into
 * @param keyLabelOut  - Receives the Gemini key label used (for audit purposes)
 */
export async function translateTextsForLang(
    texts: string[],
    langCode: string,
    keyLabelOut: { value: string },
): Promise<string[]> {
    if (texts.length <= MAX_SEGMENTS_PER_CALL) {
        return translateChunk(texts, langCode, keyLabelOut)
    }

    // Large film: split into batches, translate each, merge results
    const results: string[] = []
    for (let i = 0; i < texts.length; i += MAX_SEGMENTS_PER_CALL) {
        const chunk = texts.slice(i, i + MAX_SEGMENTS_PER_CALL)
        const translated = await translateChunk(chunk, langCode, keyLabelOut)
        results.push(...translated)
    }
    return results
}

/**
 * Map translated text lines back onto their original timing segments.
 * Falls back to the original English text for any empty translation slots.
 *
 * @param original        - Original English segments (with start/end timestamps)
 * @param translatedTexts - Translated text lines in the same order
 */
export function buildTranslatedSegments(
    original: Segment[],
    translatedTexts: string[],
): Segment[] {
    return original.map((seg, i) => ({
        start: seg.start,
        end: seg.end,
        text: translatedTexts[i] || seg.text, // fallback to English if empty
    }))
}
