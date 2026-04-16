/**
 * subtitle-service.ts — Shared server-side translation service (DIP + ISP Fix).
 *
 * DIP Fix: high-level translation logic now depends on ITranslator (abstraction),
 * NOT on the concrete GeminiTranslator. The default is GeminiTranslator, but any
 * ITranslator-compliant provider can be injected (e.g. for testing or future providers).
 *
 * ISP Fix: translateTextsForLang no longer accepts a mutable keyLabelOut object.
 * It returns { translations, keyLabel? } — callers that need the key label destructure it;
 * those that don't can ignore it without allocating a dummy object.
 *
 * SRP: this service only orchestrates chunking + segment mapping.
 *      Gemini interaction lives in GeminiTranslator.
 *      Status transitions live in subtitle-status-service.ts.
 */

import { MAX_SEGMENTS_PER_CALL } from '@/config/subtitles'
import { geminiTranslator } from '@/lib/translators/GeminiTranslator'
import type { ITranslator, TranslationResult } from '@/lib/interfaces/ITranslator'

export type Segment = { start: number; end: number; text: string }

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Translate all texts for a single language, automatically chunking large films.
 *
 * @param texts      - Raw source text lines (one per subtitle segment)
 * @param langCode   - ISO 639-1 language code to translate into
 * @param translator - Translation provider (defaults to GeminiTranslator; inject for testing)
 * @returns          - { translations: translated lines, keyLabel?: audit key used }
 */
export async function translateTextsForLang(
    texts: string[],
    langCode: string,
    translator: ITranslator = geminiTranslator,
): Promise<TranslationResult> {
    if (texts.length <= MAX_SEGMENTS_PER_CALL) {
        return translator.translateChunk(texts, langCode)
    }

    // Large film: split into batches, translate each, merge results
    const allTranslations: string[] = []
    let lastKeyLabel: string | undefined

    for (let i = 0; i < texts.length; i += MAX_SEGMENTS_PER_CALL) {
        const chunk = texts.slice(i, i + MAX_SEGMENTS_PER_CALL)
        const result = await translator.translateChunk(chunk, langCode)
        allTranslations.push(...result.translations)
        if (result.keyLabel) lastKeyLabel = result.keyLabel
    }

    return { translations: allTranslations, keyLabel: lastKeyLabel }
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
