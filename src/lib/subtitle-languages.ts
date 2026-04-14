/**
 * Canonical list of subtitle languages for the AIM Platform.
 *
 * Single source of truth — import from here, not from subtitle-translator.ts.
 * Zero dependencies. Safe to import in server routes, client components, workers.
 *
 * Language codes follow ISO 639-1.
 */

export const SUBTITLE_TARGET_LANGS = [
    'es', 'fr', 'de', 'pt', 'ru', 'zh', 'ar', 'ja', 'ko', 'hi',
] as const

export type SubtitleLangCode = typeof SUBTITLE_TARGET_LANGS[number] | 'en'

export const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    pt: 'Português',
    ru: 'Русский',
    zh: '中文',
    ar: 'العربية',
    ja: '日本語',
    ko: '한국어',
    hi: 'हिन्दी',
}

/** Total language count including English source */
export const TOTAL_SUBTITLE_LANGS = SUBTITLE_TARGET_LANGS.length + 1 // +1 for English

/**
 * Returns a display string for a lang code.
 * Falls back to the code itself if not found.
 */
export function getLangName(code: string): string {
    return LANGUAGE_NAMES[code] ?? code
}
