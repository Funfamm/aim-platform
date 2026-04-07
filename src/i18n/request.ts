import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

// Messages are split across two directories:
//   messages/        → nav, casting, login, register, dashboard, donate, forgotPassword (UI keys) etc.
//   src/messages/    → mfa, auth, langBanner, applicationSuccess, voiceRecorder, forgotPassword (OTP keys) etc.
// Both must be DEEP-merged — some sections like forgotPassword exist in both with different keys.
import enRoot from '../../messages/en.json'
import enSrc from '../messages/en.json'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Messages = Record<string, any>

/**
 * Recursively merge `override` into `base`.
 * - If both values are objects, recurse so nested keys from both are preserved.
 * - Otherwise override wins (locale text replaces English fallback).
 */
function deepMerge(base: Messages, override: Messages): Messages {
    const result: Messages = { ...base }
    for (const key of Object.keys(override)) {
        if (
            override[key] !== null &&
            typeof override[key] === 'object' &&
            !Array.isArray(override[key]) &&
            base[key] !== null &&
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

// Full English = deep-merge of both source directories
// (forgotPassword keys from root + OTP keys from src are combined)
const enFull: Messages = deepMerge(enRoot as Messages, enSrc as Messages)

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
    const rootMessages = (await import(`../../messages/${locale}.json`)).default as Messages
    const srcMessages = (await import(`../messages/${locale}.json`)).default as Messages

    // DEEP-merge the two locale sources so overlapping sections (e.g. forgotPassword)
    // get all keys from both files instead of one overwriting the other
    const localeFull = deepMerge(rootMessages, srcMessages)

    return {
        locale,
        // Final deep-merge: locale text overrides English defaults,
        // any missing keys fall back to English text instead of showing raw keys.
        messages: deepMerge(enFull, localeFull),
    }
})
