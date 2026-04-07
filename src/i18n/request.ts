import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

// Messages are split across two directories:
//   messages/        → nav, casting, login, register, dashboard, donate, etc. (30 keys)
//   src/messages/    → mfa, auth, langBanner, applicationSuccess, voiceRecorder, etc. (10 keys)
// Both must be merged for the full set.
import enRoot from '../../messages/en.json'
import enSrc from '../messages/en.json'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Messages = Record<string, any>

/** Recursively merge `override` into `base`, keeping base values for missing keys. */
function deepMerge(base: Messages, override: Messages): Messages {
    const result: Messages = { ...base }
    for (const key of Object.keys(override)) {
        if (
            override[key] &&
            typeof override[key] === 'object' &&
            !Array.isArray(override[key]) &&
            base[key] &&
            typeof base[key] === 'object' &&
            !Array.isArray(base[key])
        ) {
            result[key] = deepMerge(base[key], override[key])
        } else {
            result[key] = override[key]
        }
    }
    return result
}

// Full English fallback = both directories merged
const enFull: Messages = { ...enRoot, ...enSrc }

export default getRequestConfig(async ({ requestLocale }) => {
    let locale = await requestLocale
    // Validate that the incoming locale is supported
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!locale || !routing.locales.includes(locale as any)) {
        locale = routing.defaultLocale
    }

    if (locale === 'en') {
        return { locale, messages: enFull }
    }

    // Load both directories for this locale
    const rootMessages = (await import(`../../messages/${locale}.json`)).default
    const srcMessages = (await import(`../messages/${locale}.json`)).default

    // Merge the two locale sources together, then deep-merge with English fallback
    const localeFull = { ...rootMessages, ...srcMessages }

    return {
        locale,
        // Deep-merge: locale-specific keys override English defaults,
        // missing keys fall back to English text.
        messages: deepMerge(enFull, localeFull),
    }
})
