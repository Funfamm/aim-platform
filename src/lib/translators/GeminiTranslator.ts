/**
 * src/lib/translators/GeminiTranslator.ts — Concrete Gemini translation provider.
 *
 * Implements ITranslator. All Gemini-specific logic lives here.
 * subtitle-service.ts imports ITranslator (the abstraction), not this file directly.
 *
 * To add a new provider (e.g. OpenAI), create AzureTranslator.ts / OpenAITranslator.ts
 * implementing the same ITranslator interface — no other file changes needed (OCP).
 */

import { callGemini } from '@/lib/gemini'
import { getLangName } from '@/config/subtitles'
import type { ITranslator, TranslationResult } from '@/lib/interfaces/ITranslator'

export class GeminiTranslator implements ITranslator {
    /**
     * Translate a batch of text lines via Gemini.
     * Pads output with empty strings if the model returns fewer items than expected.
     */
    async translateChunk(texts: string[], langCode: string, sourceLang?: string): Promise<TranslationResult> {
        const langName = getLangName(langCode)
        const sourceLangName = sourceLang ? getLangName(sourceLang) : 'English'
        const sourceDesc = sourceLang && sourceLang !== 'en'
            ? `${sourceLangName} (language code: ${sourceLang})`
            : 'English'

        const prompt = [
            `You are a professional subtitle translator for a film platform.`,
            `Translate the following ${texts.length} subtitle lines from ${sourceDesc} to ${langName} (language code: ${langCode}).`,
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

        const jsonMatch = result.text.match(/\[[\s\S]*\]/)
        if (!jsonMatch) throw new Error('No JSON array in Gemini response')

        const parsed: string[] = JSON.parse(jsonMatch[0])
        // Pad to expected length if model returns shorter array
        while (parsed.length < texts.length) parsed.push('')

        return { translations: parsed, keyLabel: result.keyLabel }
    }
}

/** Module-level singleton — avoids re-instantiation on every route invocation. */
export const geminiTranslator: ITranslator = new GeminiTranslator()
