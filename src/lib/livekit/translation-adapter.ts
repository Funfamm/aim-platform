export interface TranslationAdapter {
    translate(input: {
        text: string
        sourceLang: string
        targetLang: string
        roomName: string
        participantIdentity: string
    }): Promise<{
        translatedText: string
        sourceLang: string
        targetLang: string
    }>
}

/**
 * LiveKit text stream topic constants for multilingual captions.
 * Workers publish to these topics; CaptionOverlay subscribes to the viewer's selected topic.
 */
export const CAPTION_TOPICS = {
    original: 'captions.original',
    en: 'captions.en',
    ar: 'captions.ar',
    de: 'captions.de',
    es: 'captions.es',
    fr: 'captions.fr',
    hi: 'captions.hi',
    ja: 'captions.ja',
    ko: 'captions.ko',
    pt: 'captions.pt',
    ru: 'captions.ru',
    zh: 'captions.zh',
} as const

export type CaptionLang = keyof typeof CAPTION_TOPICS
export const CAPTION_LANGS = Object.keys(CAPTION_TOPICS) as CaptionLang[]
