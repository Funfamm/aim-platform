'use client'

import { LANGUAGE_NAMES } from '@/lib/subtitle-languages'

/**
 * Client-side subtitle translation using Opus-MT models via Transformers.js.
 * Runs entirely in the browser — zero API cost.
 * 
 * Strategy: Source → English (if not already English), then English → all target languages.
 * This only requires one source model + the standard en→X models.
 */

import type { TranscriptSegment } from './transcribe-client'

// English → target language models
const EN_TO_TARGET: Record<string, string> = {
    es: 'Xenova/opus-mt-en-es',
    fr: 'Xenova/opus-mt-en-fr',
    de: 'Xenova/opus-mt-en-de',
    pt: 'Xenova/opus-mt-en-pt',
    ru: 'Xenova/opus-mt-en-ru',
    zh: 'Xenova/opus-mt-en-zh',
    ar: 'Xenova/opus-mt-en-ar',
    ja: 'Xenova/opus-mt-en-jap',
    ko: 'Xenova/opus-mt-en-ko',
    hi: 'Xenova/opus-mt-en-hi',
}

// Source → English models (for non-English films)
const SOURCE_TO_EN: Record<string, string> = {
    es: 'Xenova/opus-mt-es-en',
    fr: 'Xenova/opus-mt-fr-en',
    de: 'Xenova/opus-mt-de-en',
    pt: 'Xenova/opus-mt-pt-en', // may use ROMANCE-en
    ru: 'Xenova/opus-mt-ru-en',
    zh: 'Xenova/opus-mt-zh-en',
    ar: 'Xenova/opus-mt-ar-en',
    ja: 'Xenova/opus-mt-ja-en',
    ko: 'Xenova/opus-mt-ko-en',
    hi: 'Xenova/opus-mt-hi-en',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pipelineCache: Record<string, any> = {}

export type TranslationStatus = {
    language: string
    languageName: string
    phase: 'loading-model' | 'translating' | 'done' | 'error' | 'skipped'
    progress: number
    detail?: string
}


/**
 * Load a translation pipeline by model ID.
 */
async function loadPipeline(modelId: string) {
    if (pipelineCache[modelId]) return pipelineCache[modelId]
    try {
        const { pipeline } = await import('@huggingface/transformers')
        const translator = await pipeline('translation', modelId)
        pipelineCache[modelId] = translator
        return translator
    } catch {
        return null
    }
}

/**
 * Translate an array of segments using a given model.
 */
type TranslatorFn = (texts: string[]) => Promise<Array<{ translation_text?: string; generated_text?: string }>>
async function runTranslation(
    segments: TranscriptSegment[],
    translator: TranslatorFn,
): Promise<TranscriptSegment[]> {
    const translated: TranscriptSegment[] = []
    // Process in batches of 5
    for (let i = 0; i < segments.length; i += 5) {
        const batch = segments.slice(i, i + 5)
        const texts = batch.map(s => s.text)
        const results = await translator(texts)
        for (let j = 0; j < batch.length; j++) {
            translated.push({
                start: batch[j].start,
                end: batch[j].end,
                text: results[j]?.translation_text || results[j]?.generated_text || batch[j].text,
            })
        }
    }
    return translated
}

/**
 * Translate subtitle segments to ALL supported languages.
 * 
 * Strategy:
 * 1. If source is NOT English → translate source→English first (adds English track)
 * 2. Then translate English→all other languages using standard en→X models
 * 3. Skip the source language (it's the original transcript)
 */
export async function translateToAllLanguages(
    segments: TranscriptSegment[],
    sourceLang: string = 'en',
    onStatus?: (status: TranslationStatus) => void,
): Promise<Record<string, TranscriptSegment[]>> {
    const translations: Record<string, TranscriptSegment[]> = {}
    let englishSegments = segments

    // Step 1: If source is not English, translate to English first
    if (sourceLang !== 'en') {
        const srcToEnModel = SOURCE_TO_EN[sourceLang]
        if (srcToEnModel) {
            onStatus?.({
                language: 'en', languageName: 'English',
                phase: 'loading-model', progress: 0,
                detail: 'Loading English translation model...',
            })
            const translator = await loadPipeline(srcToEnModel)
            if (translator) {
                onStatus?.({
                    language: 'en', languageName: 'English',
                    phase: 'translating', progress: 5,
                    detail: 'Translating to English...',
                })
                englishSegments = await runTranslation(segments, translator)
                translations['en'] = englishSegments
                onStatus?.({
                    language: 'en', languageName: 'English',
                    phase: 'done', progress: 10,
                    detail: 'English complete',
                })
            }
        }
    }

    // Step 2: Translate English → all other target languages
    const targetLangs = Object.keys(EN_TO_TARGET).filter(l => l !== sourceLang)
    const totalLangs = targetLangs.length + (sourceLang !== 'en' ? 1 : 0)

    for (let i = 0; i < targetLangs.length; i++) {
        const lang = targetLangs[i]
        const langName = LANGUAGE_NAMES[lang] || lang
        const progress = Math.round(((i + (sourceLang !== 'en' ? 1 : 0)) / totalLangs) * 100)

        onStatus?.({
            language: lang, languageName: langName,
            phase: 'loading-model', progress,
            detail: `Loading ${langName} model...`,
        })

        try {
            const modelId = EN_TO_TARGET[lang]
            const translator = await loadPipeline(modelId)
            if (!translator) {
                onStatus?.({
                    language: lang, languageName: langName,
                    phase: 'skipped', progress,
                    detail: `No model for ${langName}`,
                })
                continue
            }

            onStatus?.({
                language: lang, languageName: langName,
                phase: 'translating', progress,
                detail: `Translating to ${langName}...`,
            })

            translations[lang] = await runTranslation(englishSegments, translator)

            onStatus?.({
                language: lang, languageName: langName,
                phase: 'done',
                progress: Math.round(((i + 1 + (sourceLang !== 'en' ? 1 : 0)) / totalLangs) * 100),
                detail: `${langName} complete`,
            })
        } catch {
            onStatus?.({
                language: lang, languageName: langName,
                phase: 'error', progress,
                detail: `Failed: ${langName}`,
            })
        }
    }

    return translations
}

/**
 * Get the list of all supported subtitle languages.
 */
export function getSupportedSubtitleLanguages(): { code: string; name: string }[] {
    return Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({ code, name }))
}
