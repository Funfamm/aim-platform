import { callGemini } from '@/lib/gemini'

const TARGET_LOCALES = ['es', 'fr', 'ar', 'zh', 'hi', 'pt', 'ru', 'ja', 'de', 'ko'] as const

const LOCALE_NAMES: Record<string, string> = {
    es: 'Spanish', fr: 'French', ar: 'Arabic', zh: 'Chinese (Simplified)',
    hi: 'Hindi', pt: 'Portuguese', ru: 'Russian', ja: 'Japanese', de: 'German', ko: 'Korean',
}

/**
 * Translates a set of fields into all non-English locales using AI.
 * Returns a map: { locale: { field: translatedValue } }
 * 
 * Example:
 *   translateContent({ title: "Neon Saints", tagline: "Every city has its gods" })
 *   → { zh: { title: "霓虹圣徒", tagline: "每座城市都有它的神" }, es: { ... }, ... }
 */
export async function translateContent(
    fields: Record<string, string>,
    agent: string = 'all'
): Promise<Record<string, Record<string, string>> | null> {
    // Filter out empty fields
    const nonEmpty = Object.entries(fields).filter(([, v]) => v && v.trim().length > 0)
    if (nonEmpty.length === 0) return null

    const fieldNames = nonEmpty.map(([k]) => k)
    const fieldList = nonEmpty.map(([k, v]) => `"${k}": "${v.replace(/"/g, '\\"')}"`).join(',\n    ')

    const localeList = TARGET_LOCALES.map(l => `"${l}" (${LOCALE_NAMES[l]})`).join(', ')

    const prompt = `You are a professional translator. Translate the following content into these languages: ${localeList}.

Source content (English):
{
    ${fieldList}
}

Return ONLY a valid JSON object with this exact structure — no markdown, no code fences, no explanation:
{
  "es": { ${fieldNames.map(f => `"${f}": "translated text"`).join(', ')} },
  "fr": { ${fieldNames.map(f => `"${f}": "translated text"`).join(', ')} },
  "ar": { ${fieldNames.map(f => `"${f}": "translated text"`).join(', ')} },
  "zh": { ${fieldNames.map(f => `"${f}": "translated text"`).join(', ')} },
  "hi": { ${fieldNames.map(f => `"${f}": "translated text"`).join(', ')} },
  "pt": { ${fieldNames.map(f => `"${f}": "translated text"`).join(', ')} },
  "ru": { ${fieldNames.map(f => `"${f}": "translated text"`).join(', ')} },
  "ja": { ${fieldNames.map(f => `"${f}": "translated text"`).join(', ')} },
  "de": { ${fieldNames.map(f => `"${f}": "translated text"`).join(', ')} },
  "ko": { ${fieldNames.map(f => `"${f}": "translated text"`).join(', ')} }
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
        for (const locale of TARGET_LOCALES) {
            if (!parsed[locale] || typeof parsed[locale] !== 'object') {
                console.warn(`[translate] Missing locale: ${locale}`)
            }
        }

        return parsed
    } catch (err) {
        console.error('[translate] Failed:', err instanceof Error ? err.message : err)
        return null
    }
}

/**
 * Fire-and-forget wrapper — translates and saves to DB.
 * Use this in API routes after save so it doesn't block the response.
 */
export function translateAndSave(
    fields: Record<string, string>,
    saveCallback: (translations: string) => Promise<void>
): void {
    translateContent(fields)
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
