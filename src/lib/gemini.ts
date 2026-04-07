import { prisma } from '@/lib/db'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Cool-down durations (ms)
const RATE_LIMIT_COOLDOWN_MS = 65_000    // 65 s for 429 rate-limit errors
const ERROR_COOLDOWN_MS      = 5 * 60_000 // 5 min for connection/auth/unknown errors

/**
 * Returns true if an error message is a 429 rate-limit response.
 */
function is429(msg: string): boolean {
    return (
        msg.includes('429') ||
        msg.toLowerCase().includes('quota') ||
        msg.toLowerCase().includes('rate limit') ||
        msg.toLowerCase().includes('resource_exhausted') ||
        msg.toLowerCase().includes('too many requests')
    )
}

/**
 * Universal AI caller with smart key rotation.
 *
 * Key selection strategy:
 *  1. Build a pool of active keys ordered by: preferred provider → agent-specific → lastUsed (oldest first)
 *  2. Skip any key whose cooledDownUntil is in the future (i.e. still on rate-limit cooldown)
 *  3. Pre-touch the chosen key's lastUsed to prevent concurrent requests from picking the same key
 *  4. On 429 → set cooledDownUntil = now + 65 s, then try the next key
 *  5. On success → clear cooledDownUntil, increment usageCount
 *
 * Works with Gemini, Groq, and OpenAI keys.
 */
export async function callGemini(
    prompt: string,
    agent: string = 'analytics'
): Promise<{ text: string; keyLabel: string } | { error: string }> {
    try {
        const settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } })

        // Determine preferred provider from model setting
        const model = settings?.aiModel || ''
        const preferredProvider = detectProvider(model)

        // Build provider order: preferred first, then others
        const allProviders = ['groq', 'gemini', 'openai'] as const
        const providerOrder = preferredProvider
            ? [preferredProvider, ...allProviders.filter(p => p !== preferredProvider)]
            : allProviders

        const now = new Date()

        // Collect all active, non-cooled-down keys ordered by provider preference
        let pool: Array<{ id: string; key: string; label: string; provider: string }> = []

        for (const p of providerOrder) {
            // Agent-specific keys first
            const specific = await prisma.apiKey.findMany({
                where: {
                    isActive: true,
                    provider: p,
                    assignedAgent: { in: [agent, 'all'] },
                    OR: [
                        { cooledDownUntil: null },
                        { cooledDownUntil: { lt: now } }, // cooldown has expired
                    ],
                },
            })

            // Sort: unused (null lastUsed) first → then oldest lastUsed
            const sorted = specific.sort((a, b) => {
                if (!a.lastUsed && !b.lastUsed) return Math.random() > 0.5 ? 1 : -1
                if (!a.lastUsed) return -1
                if (!b.lastUsed) return 1
                return a.lastUsed.getTime() - b.lastUsed.getTime()
            })

            if (sorted.length > 0) { pool = [...pool, ...sorted]; continue }

            // Fallback: any active key for this provider
            const any = await prisma.apiKey.findMany({
                where: {
                    isActive: true,
                    provider: p,
                    OR: [
                        { cooledDownUntil: null },
                        { cooledDownUntil: { lt: now } },
                    ],
                },
            })

            any.sort((a, b) => {
                if (!a.lastUsed && !b.lastUsed) return Math.random() > 0.5 ? 1 : -1
                if (!a.lastUsed) return -1
                if (!b.lastUsed) return 1
                return a.lastUsed.getTime() - b.lastUsed.getTime()
            })

            pool = [...pool, ...any]
        }

        // Env/settings fallbacks (not stored in DB, no cooldown support — last resort)
        if (pool.length === 0) {
            const fbKey = settings?.geminiApiKey
            if (fbKey)                        pool = [{ id: 'settings', key: fbKey,                        label: 'Settings Key', provider: 'gemini' }]
            else if (process.env.GROQ_API_KEY) pool = [{ id: 'env',      key: process.env.GROQ_API_KEY!,   label: 'Env Groq',    provider: 'groq'   }]
            else if (process.env.GEMINI_API_KEY) pool = [{ id: 'env',    key: process.env.GEMINI_API_KEY!, label: 'Env Gemini',  provider: 'gemini' }]
            else if (process.env.OPENAI_API_KEY) pool = [{ id: 'env',    key: process.env.OPENAI_API_KEY!, label: 'Env OpenAI',  provider: 'openai' }]
        }

        if (pool.length === 0) {
            return { error: 'All API keys are rate-limited or unavailable. Try again in 1 minute, or add more keys in Admin → Settings → API Keys.' }
        }

        let lastKeyError = ''

        for (const key of pool) {
            try {
                const defaultModels: Record<string, string> = {
                    groq: 'llama-3.3-70b-versatile',
                    gemini: 'gemini-2.0-flash',
                    openai: 'gpt-4o-mini',
                }
                const useModel = (detectProvider(model) === key.provider && model) ? model : defaultModels[key.provider]

                // Pre-emptively mark lastUsed and clear the expired cooldown timer so
                // concurrent requests don't all pick the same key. We deliberately
                // DO NOT clear lastError here — that stays visible until a successful
                // call clears it, so the admin dashboard can see the key had trouble.
                if (key.id !== 'env' && key.id !== 'settings') {
                    prisma.apiKey.update({
                        where: { id: key.id },
                        data: {
                            lastUsed: new Date(),
                            cooledDownUntil: null, // expire the cooldown timer now
                        },
                    }).catch(() => { /* fire-and-forget pre-touch */ })
                }

                let text = ''

                if (key.provider === 'groq') {
                    text = await callGroqProvider(key.key, useModel, prompt)
                } else if (key.provider === 'openai') {
                    text = await callOpenAIProvider(key.key, useModel, prompt)
                } else {
                    text = await callGeminiProvider(key.key, useModel, prompt)
                }

                // ✅ Success — clear cooldown and increment usage
                if (key.id !== 'env' && key.id !== 'settings') {
                    await prisma.apiKey.update({
                        where: { id: key.id },
                        data: {
                            usageCount: { increment: 1 },
                            lastUsed: new Date(),
                            lastError: null,
                            cooledDownUntil: null, // clear any residual cooldown
                        },
                    }).catch(() => { /* non-critical */ })
                }

                return { text, keyLabel: key.label }
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err)
                lastKeyError = `${errMsg} (key: ${key.label})`

                if (key.id !== 'env' && key.id !== 'settings') {
                    // Cool down on ANY error — rate-limit gets short cooldown, other errors get longer
                    const isRateLimit = is429(errMsg)
                    const cooldownMs = isRateLimit ? RATE_LIMIT_COOLDOWN_MS : ERROR_COOLDOWN_MS

                    await prisma.apiKey.update({
                        where: { id: key.id },
                        data: {
                            lastError: isRateLimit
                                ? `Rate limited (429) — cooling down for ${cooldownMs / 1000}s`
                                : `${errMsg.slice(0, 150)} — cooling down for ${cooldownMs / 1000}s`,
                            lastUsed: new Date(),
                            cooledDownUntil: new Date(Date.now() + cooldownMs),
                        },
                    }).catch(() => { /* non-critical */ })
                }

                // Always continue to the next key regardless of error type
                continue
            }
        }

        return { error: lastKeyError || 'All API keys failed. Check your keys in Admin → Settings → API Keys.' }
    } catch (err) {
        return { error: `Failed to initialize AI: ${err instanceof Error ? err.message : String(err)}` }
    }
}

// ─── Provider detection ───────────────────────────────────────────────────────
const GROQ_PREFIXES = ['llama', 'mixtral', 'gemma', 'qwen', 'deepseek', 'meta-llama']
const OPENAI_PREFIXES = ['gpt-', 'o1', 'o3', 'o4']

function detectProvider(model: string): 'groq' | 'gemini' | 'openai' | null {
    if (!model) return null
    const lower = model.toLowerCase()
    if (GROQ_PREFIXES.some(p => lower.startsWith(p)) || lower.includes('groq')) return 'groq'
    if (OPENAI_PREFIXES.some(p => lower.startsWith(p))) return 'openai'
    if (lower.startsWith('gemini')) return 'gemini'
    return null
}

// ─── Gemini ──────────────────────────────────────────────────────────────────
async function callGeminiProvider(apiKey: string, model: string, prompt: string): Promise<string> {
    const genAI = new GoogleGenerativeAI(apiKey)
    const aiModel = genAI.getGenerativeModel({ model })
    const result = await aiModel.generateContent(prompt)
    return result.response.text()
}

// ─── Groq ────────────────────────────────────────────────────────────────────
async function callGroqProvider(apiKey: string, model: string, prompt: string): Promise<string> {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model, temperature: 0.7, max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
        }),
    })
    if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(err?.error?.message || `Groq error: ${res.status}`)
    }
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    return data.choices?.[0]?.message?.content || ''
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────
async function callOpenAIProvider(apiKey: string, model: string, prompt: string): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model, temperature: 0.7, max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
        }),
    })
    if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(err?.error?.message || `OpenAI error: ${res.status}`)
    }
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    return data.choices?.[0]?.message?.content || ''
}
