import { prisma } from '@/lib/db'
import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * Universal AI caller with automatic key rotation.
 * Works with Gemini, Groq, and OpenAI keys.
 * Tries keys assigned to the given agent first, then falls back to any active key.
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

        // Collect all active keys, ordered by provider preference
        let pool: Array<{ id: string; key: string; label: string; provider: string }> = []

        for (const p of providerOrder) {
            // Agent-specific keys first
            const specific = await prisma.apiKey.findMany({
                where: { isActive: true, provider: p, assignedAgent: { in: [agent, 'all'] } },
                orderBy: { lastUsed: 'asc' },
            })
            if (specific.length > 0) { pool = [...pool, ...specific]; continue }

            // Any active key for this provider
            const any = await prisma.apiKey.findMany({
                where: { isActive: true, provider: p },
                orderBy: { lastUsed: 'asc' },
            })
            pool = [...pool, ...any]
        }

        // Env/settings fallbacks if still empty
        if (pool.length === 0) {
            const fbKey = settings?.geminiApiKey
            if (fbKey) pool = [{ id: 'settings', key: fbKey, label: 'Settings Key', provider: 'gemini' }]
            else if (process.env.GROQ_API_KEY) pool = [{ id: 'env', key: process.env.GROQ_API_KEY, label: 'Env Groq', provider: 'groq' }]
            else if (process.env.GEMINI_API_KEY) pool = [{ id: 'env', key: process.env.GEMINI_API_KEY, label: 'Env Gemini', provider: 'gemini' }]
            else if (process.env.OPENAI_API_KEY) pool = [{ id: 'env', key: process.env.OPENAI_API_KEY, label: 'Env OpenAI', provider: 'openai' }]
        }

        if (pool.length === 0) {
            return { error: 'No active API keys configured. Add keys in Admin → Settings → API Keys.' }
        }

        let lastKeyError = ''

        for (const key of pool) {
            try {
                const defaultModels: Record<string, string> = {
                    groq: 'llama-3.3-70b-versatile',
                    gemini: 'gemini-2.5-flash',
                    openai: 'gpt-4o-mini',
                }
                const useModel = (detectProvider(model) === key.provider && model) ? model : defaultModels[key.provider]

                let text = ''

                if (key.provider === 'groq') {
                    text = await callGroqProvider(key.key, useModel, prompt)
                } else if (key.provider === 'openai') {
                    text = await callOpenAIProvider(key.key, useModel, prompt)
                } else {
                    text = await callGeminiProvider(key.key, useModel, prompt)
                }

                // Success — update usage
                if (key.id !== 'env' && key.id !== 'settings') {
                    await prisma.apiKey.update({
                        where: { id: key.id },
                        data: { usageCount: { increment: 1 }, lastUsed: new Date(), lastError: null },
                    }).catch(() => { /* non-critical */ })
                }

                return { text, keyLabel: key.label }
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err)
                lastKeyError = `${errMsg} (key: ${key.label})`
                if (key.id !== 'env' && key.id !== 'settings') {
                    await prisma.apiKey.update({
                        where: { id: key.id },
                        data: { lastError: errMsg.slice(0, 200), lastUsed: new Date() },
                    }).catch(() => { /* non-critical */ })
                }
                continue
            }
        }

        return { error: lastKeyError || 'All API keys failed. Check your keys in Admin → Settings → API Keys.' }
    } catch (err) {
        return { error: `Failed to initialize AI: ${err instanceof Error ? err.message : String(err)}` }
    }
}

// ─── Provider detection ───
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

// ─── Gemini ───
async function callGeminiProvider(apiKey: string, model: string, prompt: string): Promise<string> {
    const genAI = new GoogleGenerativeAI(apiKey)
    const aiModel = genAI.getGenerativeModel({ model })
    const result = await aiModel.generateContent(prompt)
    return result.response.text()
}

// ─── Groq ───
async function callGroqProvider(apiKey: string, model: string, prompt: string): Promise<string> {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model, temperature: 0.7, max_tokens: 2048,
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

// ─── OpenAI ───
async function callOpenAIProvider(apiKey: string, model: string, prompt: string): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model, temperature: 0.7, max_tokens: 2048,
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
