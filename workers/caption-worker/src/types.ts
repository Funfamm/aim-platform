/** A single transcribed + optionally translated caption segment */
export interface CaptionSegment {
    /** Milliseconds since Unix epoch */
    timestamp: number
    /** LiveKit participant identity who spoke */
    speakerIdentity: string
    speakerName: string
    /** BCP-47 language code detected by Whisper, or 'unknown' */
    sourceLang: string
    /** Original transcribed text */
    originalText: string
}

/** A translated caption segment ready to publish on a language topic */
export interface TranslatedCaption {
    segment: CaptionSegment
    targetLang: string
    translatedText: string
}

/** Accumulated PCM audio frames from a single participant */
export interface AudioChunk {
    participantIdentity: string
    participantName: string
    /** Raw PCM samples — Int16, little-endian, mono 16 kHz */
    samples: Int16Array
    sampleRate: number
}

/** Payload sent to the worker's /start-session endpoint */
export interface StartSessionPayload {
    roomName: string
    /** ISO timestamp when the room started */
    startedAt: string
}

/** Topic constants — must exactly match the Next.js app's translation-adapter.ts */
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
export const CAPTION_LANG_NAMES: Record<CaptionLang, string> = {
    original: 'Original',
    en: 'English',
    ar: 'Arabic',
    de: 'German',
    es: 'Spanish',
    fr: 'French',
    hi: 'Hindi',
    ja: 'Japanese',
    ko: 'Korean',
    pt: 'Portuguese',
    ru: 'Russian',
    zh: 'Chinese',
}
