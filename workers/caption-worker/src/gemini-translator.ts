import { GoogleGenerativeAI } from '@google/generative-ai'
import { config } from './config'
import type { CaptionSegment, TranslatedCaption } from './types'
import { CAPTION_LANG_NAMES } from './types'

const genai = new GoogleGenerativeAI(config.gemini.apiKey)

// Reuse a single model instance to avoid re-initializing per caption
const model = genai.getGenerativeModel({
    model: config.gemini.model,
    generationConfig: {
        // Keep translations very concise — we're rendering in real-time captions
        maxOutputTokens: 256,
        temperature: 0.1, // near-deterministic for translation consistency
    },
})

/**
 * Translates a single caption segment into all configured target languages.
 * Returns an array of TranslatedCaption objects — one per language.
 * Languages that fail are skipped (non-fatal) so partial translations still publish.
 */
export async function translateSegment(segment: CaptionSegment): Promise<TranslatedCaption[]> {
    if (!config.features.enableTranslation) return []

    const targetLangs = config.features.translateLangs.filter(
        // Skip translation if the target language is the same as the source
        (lang) => lang !== segment.sourceLang,
    )

    // Run all translations in parallel — Gemini Flash is fast enough
    const results = await Promise.allSettled(
        targetLangs.map((lang) => translateToLang(segment, lang)),
    )

    return results
        .filter((r): r is PromiseFulfilledResult<TranslatedCaption> => r.status === 'fulfilled')
        .map((r) => r.value)
}

async function translateToLang(
    segment: CaptionSegment,
    targetLang: string,
): Promise<TranslatedCaption> {
    const langName = CAPTION_LANG_NAMES[targetLang as keyof typeof CAPTION_LANG_NAMES] ?? targetLang

    const prompt = [
        `You are a professional real-time caption translator.`,
        `Translate the following speech caption to ${langName}.`,
        `Rules:`,
        `- Output ONLY the translated text, no explanation, no quotes.`,
        `- Preserve punctuation and sentence structure.`,
        `- If the input is already in ${langName}, output it unchanged.`,
        `- Keep the translation concise and natural for a live caption.`,
        ``,
        `Caption: ${segment.originalText}`,
    ].join('\n')

    const result = await model.generateContent(prompt)
    const translatedText = result.response.text().trim()

    if (!translatedText) {
        throw new Error(`Empty translation for lang=${targetLang}`)
    }

    return {
        segment,
        targetLang,
        translatedText,
    }
}

/**
 * Health-check: verifies the Gemini API key is valid with a minimal request.
 */
export async function checkGeminiHealth(): Promise<boolean> {
    try {
        const result = await model.generateContent('Say OK')
        return result.response.text().length > 0
    } catch {
        return false
    }
}
