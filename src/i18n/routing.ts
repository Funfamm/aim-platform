import { defineRouting } from 'next-intl/routing'

export const locales = ['en', 'es', 'fr', 'ar', 'zh', 'hi', 'pt', 'ru', 'ja', 'de', 'ko'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'

export const routing = defineRouting({
    locales,
    defaultLocale,
    localePrefix: 'as-needed', // /casting → English (default), /es/casting → Spanish
    localeDetection: true,     // Auto-detect from Accept-Language header on first visit
})

export const localeNames: Record<Locale, string> = {
    en: 'English',
    es: 'Español',
    fr: 'Français',
    ar: 'العربية',
    zh: '中文',
    hi: 'हिन्दी',
    pt: 'Português',
    ru: 'Русский',
    ja: '日本語',
    de: 'Deutsch',
    ko: '한국어',
}
