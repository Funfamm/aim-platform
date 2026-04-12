import { callGemini } from '@/lib/gemini'
import { prisma } from '@/lib/db'

const TARGET_LOCALES = ['es', 'fr', 'ar', 'zh', 'hi', 'pt', 'ru', 'ja', 'de', 'ko'] as const

const LOCALE_NAMES: Record<string, string> = {
    es: 'Spanish', fr: 'French', ar: 'Arabic', zh: 'Chinese (Simplified)',
    hi: 'Hindi', pt: 'Portuguese', ru: 'Russian', ja: 'Japanese', de: 'German', ko: 'Korean',
}

/**
 * Translates a set of fields into all non-English locales (or a subset) using AI.
 * Returns a map: { locale: { field: translatedValue } }
 *
 * @param fields       - The English source fields to translate
 * @param agent        - Which API key pool to use
 * @param onlyLocales  - If provided, only translate these specific locales (used for partial retries)
 *
 * Example:
 *   translateContent({ title: "Neon Saints", tagline: "Every city has its gods" })
 *   → { zh: { title: "霓虹圣徒", tagline: "每座城市都有它的神" }, es: { ... }, ... }
 */
export async function translateContent(
    fields: Record<string, string>,
    agent: string = 'all',
    onlyLocales?: string[]
): Promise<Record<string, Record<string, string>> | null> {
    // Filter out empty fields
    const nonEmpty = Object.entries(fields).filter(([, v]) => v && v.trim().length > 0)
    if (nonEmpty.length === 0) return null

    // Determine which locales to request
    const requestLocales = onlyLocales
        ? TARGET_LOCALES.filter(l => onlyLocales.includes(l))
        : [...TARGET_LOCALES]

    if (requestLocales.length === 0) {
        console.log('[translate] No locales to translate — all already done')
        return null
    }

    const fieldNames = nonEmpty.map(([k]) => k)
    const fieldList = nonEmpty.map(([k, v]) => `"${k}": "${v.replace(/"/g, '\\"')}"`).join(',\n    ')
    const localeList = requestLocales.map(l => `"${l}" (${LOCALE_NAMES[l]})`).join(', ')

    const localeBlock = requestLocales
        .map(l => `  "${l}": { ${fieldNames.map(f => `"${f}": "translated text"`).join(', ')} }`)
        .join(',\n')

    const prompt = `You are a professional translator. Translate the following content into these languages: ${localeList}.

Source content (English):
{
    ${fieldList}
}

Return ONLY a valid JSON object with this exact structure — no markdown, no code fences, no explanation:
{
${localeBlock}
}

Important rules:
- Translate naturally, not word-for-word. Use proper grammar and tone for each language.
- Keep proper nouns (character names, place names) in their original form.
- Return ONLY the JSON object, nothing else.`

    try {
        const result = await callGemini(prompt, agent)
        if ('error' in result) {
            console.error('[translate] AI error:', result.error)
            return null
        }

        // Clean the response — strip markdown fences if present
        let text = result.text.trim()
        if (text.startsWith('```')) {
            text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
        }

        const parsed = JSON.parse(text) as Record<string, Record<string, string>>

        // Validate structure
        for (const locale of requestLocales) {
            if (!parsed[locale] || typeof parsed[locale] !== 'object') {
                console.warn(`[translate] Missing locale in response: ${locale}`)
            }
        }

        return parsed
    } catch (err) {
        console.error('[translate] Failed:', err instanceof Error ? err.message : err)
        return null
    }
}

/**
 * Fire-and-forget wrapper — translates all locales and saves to DB.
 * Use this in API routes after save so it doesn't block the response.
 */
export function translateAndSave(
    fields: Record<string, string>,
    saveCallback: (translations: string) => Promise<void>,
    agent: string = 'all'
): void {
    translateContent(fields, agent)
        .then(async (result) => {
            if (result) {
                await saveCallback(JSON.stringify(result))
                console.log('[translate] Saved translations for', Object.keys(fields).join(', '))
            }
        })
        .catch((err) => {
            console.error('[translate] Background save failed:', err)
        })
}

/**
 * Retry translation — only translates missing locales, merges with existing.
 * Use this when a previous translateAndSave() completed partially (e.g. API hiccup)
 * so we never waste quota re-translating what's already been done.
 *
 * @param fields              - The English source fields (current values)
 * @param existingJson        - The current contentTranslations / translations JSON string from DB
 * @param saveCallback        - Called with the merged full translations JSON string
 * @param agent               - Which API key pool to use
 */
export function retryMissingTranslations(
    fields: Record<string, string>,
    existingJson: string | null | undefined,
    saveCallback: (translations: string) => Promise<void>,
    agent: string = 'all'
): void {
    // Parse existing so we know what's already done
    let existing: Record<string, Record<string, string>> = {}
    if (existingJson) {
        try { existing = JSON.parse(existingJson) } catch { /* start fresh */ }
    }

    // Find locales that are genuinely missing (no entry at all)
    const missingLocales = TARGET_LOCALES.filter(l => !existing[l] || Object.keys(existing[l]).length === 0)

    if (missingLocales.length === 0) {
        console.log('[translate] No missing locales — skipping retry')
        return
    }

    console.log('[translate] Retrying missing locales:', missingLocales.join(', '))

    translateContent(fields, agent, missingLocales)
        .then(async (newTranslations) => {
            if (newTranslations) {
                // Merge: existing is the base, newTranslations fills the gaps
                const merged = { ...existing, ...newTranslations }
                await saveCallback(JSON.stringify(merged))
                console.log('[translate] Retry: filled', missingLocales.length, 'missing locale(s)')
            }
        })
        .catch((err) => {
            console.error('[translate] Retry save failed:', err)
        })
}

const LOCALE_NAME_MAP: Record<string, string> = {
    ar: 'Arabic', zh: 'Chinese (Simplified)', fr: 'French', es: 'Spanish',
    de: 'German', pt: 'Portuguese', hi: 'Hindi', ja: 'Japanese', ko: 'Korean', ru: 'Russian',
}

// ── L1: In-memory cache (instant, per server session) ────────────────────────
interface CacheEntry { value: string; expiresAt: number }
const memCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const CACHE_MAX = 500

function memGet(key: string): string | null {
    const entry = memCache.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) { memCache.delete(key); return null }
    return entry.value
}
function memSet(key: string, value: string) {
    if (memCache.size >= CACHE_MAX) {
        const first = memCache.keys().next().value
        if (first) memCache.delete(first)
    }
    memCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
}
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Translate a statusNote to the user's locale.
 *
 * 3-tier caching so the AI API is called as rarely as possible:
 *  1. In-memory cache  — instant (survives within the same server session)
 *  2. Database cache   — persists across ALL server restarts; stored in
 *                         Application.statusNoteTranslations (JSON)
 *  3. AI API call      — only for a brand-new locale+application combination;
 *                         result is saved to DB immediately for future requests
 *
 * For English users (locale='en') the original text is returned immediately.
 *
 * Pass `applicationId` to enable DB caching. Without it the function still works
 * but only uses the in-memory & AI-call tiers.
 */
export async function translateStatusNote(
    text: string | null | undefined,
    locale: string,
    applicationId?: string,
): Promise<string | null> {
    if (!text || !locale || locale === 'en') return text ?? null
    const targetLang = LOCALE_NAME_MAP[locale]
    if (!targetLang) return text

    const cacheKey = `${locale}:${applicationId ?? text.slice(0, 40)}`

    // ── Tier 1: memory ────────────────────────────────────────────────────────
    const fromMem = memGet(cacheKey)
    if (fromMem !== null) return fromMem

    // ── Tier 2: database ──────────────────────────────────────────────────────
    if (applicationId) {
        try {
            const app = await prisma.application.findUnique({
                where: { id: applicationId },
                select: { statusNoteTranslations: true },
            })
            if (app?.statusNoteTranslations) {
                const stored: Record<string, string> = JSON.parse(app.statusNoteTranslations)
                if (stored[locale]) {
                    memSet(cacheKey, stored[locale])
                    return stored[locale]
                }
            }
        } catch { /* non-critical — fall through to AI */ }
    }

    // ── Tier 3: AI API call (only when nothing is cached) ────────────────────
    try {
        const prompt = `Translate this casting feedback message to ${targetLang}. Keep the warm, personal, and encouraging tone. Return ONLY the translated text with no explanation:\n\n${text}`
        const result = await callGemini(prompt, 'audition')
        if ('error' in result || !result.text) return text
        const translated = result.text.trim() || text

        // Save to memory cache
        memSet(cacheKey, translated)

        // Save to DB so we never call the API again for this application+locale
        if (applicationId) {
            try {
                const app = await prisma.application.findUnique({
                    where: { id: applicationId },
                    select: { statusNoteTranslations: true },
                })
                const existing = app?.statusNoteTranslations
                    ? JSON.parse(app.statusNoteTranslations) as Record<string, string>
                    : {}
                existing[locale] = translated
                await prisma.application.update({
                    where: { id: applicationId },
                    data: { statusNoteTranslations: JSON.stringify(existing) },
                })
            } catch { /* non-critical */ }
        }

        return translated
    } catch {
        return text
    }
}
