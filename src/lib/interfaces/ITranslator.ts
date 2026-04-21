/**
 * src/lib/interfaces/ITranslator.ts — Translation provider abstraction (DIP / OCP).
 *
 * High-level modules (subtitle-service, routes) depend on this interface,
 * NOT on the concrete GeminiTranslator. Swapping to a different AI provider
 * (Azure AI, OpenAI, etc.) requires only a new class that implements ITranslator
 * — zero changes to subtitle-service or any route.
 */

export interface TranslationResult {
    /** Translated text lines, one per input segment, in the same order. */
    translations: string[]
    /** The API key label used (for audit/logging). Undefined if not applicable. */
    keyLabel?: string
}

/**
 * Contract for any translation provider.
 * Implementations must handle chunking internally or delegate to translateTextsForLang.
 */
export interface ITranslator {
    /**
     * Translate a batch of plain-text lines into the target language.
     *
     * @param texts      - Source text lines (in whatever language the video was spoken)
     * @param langCode   - ISO 639-1 target language code
     * @param sourceLang - ISO 639-1 source language code (optional; improves AI quality)
     * @returns          - Translated lines in the same order + optional key label
     */
    translateChunk(texts: string[], langCode: string, sourceLang?: string): Promise<TranslationResult>
}
