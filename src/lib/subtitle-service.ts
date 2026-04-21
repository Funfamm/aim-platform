/**
 * subtitle-service.ts — Shared server-side translation service (DIP + ISP + OCP fix).
 *
 * DIP Fix: depends only on ITranslator abstraction. Default provider is
 * resolved via the translator registry — NOT imported concretely at module level.
 *
 * ISP Fix: returns { translations, keyLabel? } instead of mutating keyLabelOut.
 *
 * OCP Fix: swapping the platform-wide default translator requires only a call
 * to registerTranslator() in the registry — this file never changes.
 */

import { MAX_SEGMENTS_PER_CALL } from '@/config/subtitles'
import { getTranslator } from '@/lib/translators/registry'
import type { ITranslator, TranslationResult } from '@/lib/interfaces/ITranslator'

export type Segment = { start: number; end: number; text: string }

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Translate all texts for a single language, automatically chunking large films.
 *
 * @param texts      - Raw source text lines (one per subtitle segment)
 * @param langCode   - ISO 639-1 language code to translate into
 * @param translator - Optional override; defaults to the registered platform provider
 * @returns          - { translations, keyLabel? }
 */
export async function translateTextsForLang(
    texts: string[],
    langCode: string,
    sourceLang?: string,
    translator: ITranslator = getTranslator(),
): Promise<TranslationResult> {
    if (texts.length <= MAX_SEGMENTS_PER_CALL) {
        return translator.translateChunk(texts, langCode, sourceLang)
    }

    const allTranslations: string[] = []
    let lastKeyLabel: string | undefined

    for (let i = 0; i < texts.length; i += MAX_SEGMENTS_PER_CALL) {
        const chunk = texts.slice(i, i + MAX_SEGMENTS_PER_CALL)
        const result = await translator.translateChunk(chunk, langCode, sourceLang)
        allTranslations.push(...result.translations)
        if (result.keyLabel) lastKeyLabel = result.keyLabel
    }

    return { translations: allTranslations, keyLabel: lastKeyLabel }
}

/**
 * Map translated text lines back onto their original timing segments.
 * Falls back to the original English text for any empty translation slots.
 */
export function buildTranslatedSegments(
    original: Segment[],
    translatedTexts: string[],
): Segment[] {
    return original.map((seg, i) => ({
        start: seg.start,
        end: seg.end,
        // Use empty string for missing slots — never fall back to source-language text,
        // which would silently insert foreign words into a labelled translated track.
        text: translatedTexts[i] ?? '',
    }))
}
