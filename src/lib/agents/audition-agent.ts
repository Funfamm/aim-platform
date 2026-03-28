import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from '@/lib/db'
import { readFile } from 'fs/promises'
import path from 'path'

interface AuditInput {
    applicant: {
        fullName: string
        age: number | null
        gender: string | null
        experience: string
        specialSkills: string | null
        personality: {
            describe_yourself: string
            why_acting: string
            dream_role: string
            unique_quality: string
        }
        photoUrls?: string[]  // Uploaded headshot/portfolio photo paths
    }
    role: {
        roleName: string
        roleType: string
        roleDescription: string
        requirements: string
        ageRange: string | null
        gender: string | null
        projectTitle: string
    }
    locale?: string  // User's language preference (e.g. 'zh', 'es', 'fr')
}

export interface AuditReport {
    overallScore: number
    roleFitScore: number
    strengths: string[]
    concerns: string[]
    recommendation: 'STRONG_FIT' | 'GOOD_FIT' | 'MODERATE' | 'WEAK_FIT'
    notes: string
    applicantFeedback: string
    visualAssessment?: string  // AI assessment of applicant photos
}

// ═══ IN-MEMORY RATE LIMITER ═══
// Tracks calls per key in a sliding 60-second window
const keyUsage: Map<string, number[]> = new Map()

// Keys that have hit the daily quota (429). Cleared at midnight UTC.
const dailyExhaustedKeys: Set<string> = new Set()
let exhaustedResetDate = new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD'

/** Reset daily exhaustion tracking if the UTC date has changed */
function checkDailyReset() {
    const today = new Date().toISOString().slice(0, 10)
    if (today !== exhaustedResetDate) {
        dailyExhaustedKeys.clear()
        exhaustedResetDate = today
        console.log('[AI Audit] Daily quota reset — clearing exhausted key list')
    }
}

/** Mark a key as having hit the daily quota (429) */
function markDailyExhausted(keyId: string) {
    dailyExhaustedKeys.add(keyId)
    console.warn(`[AI Audit] Key ${keyId} marked as daily-exhausted (429 quota)`)
}

/** Returns true if the error is a daily quota exhaustion (429) */
function isDailyQuotaError(errMsg: string): boolean {
    return errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('Too Many Requests')
}

// RPM limits per provider (conservative — leaves headroom)
const RPM_LIMITS: Record<string, number> = {
    gemini: 12,   // Gemini free tier is 15 RPM, we stop at 12
    groq: 25,     // Groq free tier is 30 RPM, we stop at 25
    openai: 50,   // OpenAI varies, 50 is safe for most tiers
}

// Daily request quota per API key (free tier limit). Adjust if you have a paid plan.
const DAILY_QUOTA = 20; // number of requests allowed per key per day


/** Record a call for a key and return current usage in the window */
function recordKeyUsage(keyId: string): number {
    const now = Date.now()
    const windowMs = 60_000
    const timestamps = (keyUsage.get(keyId) || []).filter(t => now - t < windowMs)
    timestamps.push(now)
    keyUsage.set(keyId, timestamps)
    return timestamps.length
}

/** Check if a key has capacity (calls in last 60s < limit) */
function hasCapacity(keyId: string, provider: string): boolean {
    const now = Date.now()
    const timestamps = (keyUsage.get(keyId) || []).filter(t => now - t < 60_000)
    const limit = RPM_LIMITS[provider] || 10
    return timestamps.length < limit
}

/** Get remaining capacity for a key */
function getRemainingCapacity(keyId: string, provider: string): number {
    const now = Date.now()
    const timestamps = (keyUsage.get(keyId) || []).filter(t => now - t < 60_000)
    const limit = RPM_LIMITS[provider] || 10
    return Math.max(0, limit - timestamps.length)
}

// Provider detection
const GROQ_MODELS = ['llama', 'mixtral', 'gemma', 'qwen', 'deepseek', 'llama-3', 'llama3', 'meta-llama']
const OPENAI_MODELS = ['gpt-', 'o1', 'o3', 'o4']

function detectProvider(model: string): 'groq' | 'gemini' | 'openai' | null {
    if (!model) return null
    const lower = model.toLowerCase()
    if (GROQ_MODELS.some(m => lower.startsWith(m)) || lower.includes('groq')) return 'groq'
    if (OPENAI_MODELS.some(m => lower.startsWith(m))) return 'openai'
    if (lower.startsWith('gemini')) return 'gemini'
    return null
}

/**
 * Get AI config with key rotation scoped to the "audition" agent.
 * Tries all keys assigned to "audition" or "all", rotating on failure.
 */
async function getAIConfig() {
    try {
        const settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } })

        // Determine model and provider from settings
        const model = settings?.aiModel || ''
        let provider: 'groq' | 'gemini' | 'openai' = detectProvider(model) || 'gemini'

        // Get default models per provider
        const defaultModel = {
            groq: 'llama-3.3-70b-versatile',
            gemini: 'gemini-2.5-flash',
            openai: 'gpt-4o-mini',
        }
        const resolvedModel = model || defaultModel[provider]

        // Try to find keys for the detected provider first, then fall back to others
        const providerOrder: Array<'groq' | 'gemini' | 'openai'> = [provider,
            ...(['groq', 'gemini', 'openai'] as const).filter(p => p !== provider)
        ]

        // Build a flat list of ALL keys across all providers in preferred order.
        // This lets the rotation engine fall through from one provider to the next
        // when all keys for a given provider are daily-exhausted.
        const allKeys: Array<{ id: string; key: string; label: string; provider: 'groq' | 'gemini' | 'openai'; model: string }> = []

        for (const p of providerOrder) {
            // Only use keys explicitly assigned to 'audition' or 'all' — strictly enforced
            const keys = await prisma.apiKey.findMany({
                where: { isActive: true, provider: p, assignedAgent: { in: ['audition', 'all'] } },
                orderBy: { lastUsed: 'asc' },
            })
            const useModel = (p === provider && resolvedModel) ? resolvedModel : defaultModel[p]
            for (const k of keys) {
                allKeys.push({ id: k.id, key: k.key, label: k.label, provider: p, model: useModel })
            }
        }

        if (allKeys.length > 0) {
            return {
                keys: allKeys,
                provider,           // default provider (may change per-key during rotation)
                model: resolvedModel || defaultModel[provider],
                customPrompt: settings?.aiCustomPrompt || '',
            }
        }

        // Last resort: settings.geminiApiKey or env vars
        const fallbackKey = settings?.geminiApiKey || ''
        if (fallbackKey) {
            return { keys: [{ id: 'settings', key: fallbackKey, label: 'Settings Key' }], provider: 'gemini' as const, model: resolvedModel || 'gemini-2.5-flash', customPrompt: settings?.aiCustomPrompt || '' }
        }
        if (process.env.GROQ_API_KEY) {
            return { keys: [{ id: 'env', key: process.env.GROQ_API_KEY, label: 'Env Key' }], provider: 'groq' as const, model: 'llama-3.3-70b-versatile', customPrompt: settings?.aiCustomPrompt || '' }
        }
        if (process.env.GEMINI_API_KEY) {
            return { keys: [{ id: 'env', key: process.env.GEMINI_API_KEY, label: 'Env Key' }], provider: 'gemini' as const, model: 'gemini-2.5-flash', customPrompt: settings?.aiCustomPrompt || '' }
        }
        if (process.env.OPENAI_API_KEY) {
            return { keys: [{ id: 'env', key: process.env.OPENAI_API_KEY, label: 'Env Key' }], provider: 'openai' as const, model: 'gpt-4o-mini', customPrompt: settings?.aiCustomPrompt || '' }
        }

        return { keys: [], provider: 'gemini' as const, model: 'gemini-2.5-flash', customPrompt: '' }
    } catch {
        if (process.env.GROQ_API_KEY) return { keys: [{ id: 'env', key: process.env.GROQ_API_KEY, label: 'Env' }], provider: 'groq' as const, model: 'llama-3.3-70b-versatile', customPrompt: '' }
        if (process.env.GEMINI_API_KEY) return { keys: [{ id: 'env', key: process.env.GEMINI_API_KEY, label: 'Env' }], provider: 'gemini' as const, model: 'gemini-2.5-flash', customPrompt: '' }
        if (process.env.OPENAI_API_KEY) return { keys: [{ id: 'env', key: process.env.OPENAI_API_KEY, label: 'Env' }], provider: 'openai' as const, model: 'gpt-4o-mini', customPrompt: '' }
        return { keys: [], provider: 'gemini' as const, model: 'gemini-2.5-flash', customPrompt: '' }
    }
}

const LOCALE_NAMES: Record<string, string> = {
    en: 'English', es: 'Spanish', fr: 'French', ar: 'Arabic', zh: 'Chinese (Simplified)',
    hi: 'Hindi', pt: 'Portuguese', ru: 'Russian', ja: 'Japanese', de: 'German', ko: 'Korean',
}

function buildPrompt(input: AuditInput, customPrompt: string, hasPhotos: boolean): string {
    const lang = LOCALE_NAMES[input.locale || 'en'] || 'English'
    let prompt = `You are the AI assessment assistant for AIM Studio, an AI-powered film production company.

Your task is to analyze a casting applicant's submission and generate a structured compatibility report. 

## IMPORTANT RULES
- Do NOT evaluate or comment on the applicant's past experience or acting history
- Base your evaluation ONLY on the information and materials the applicant has submitted (personality answers, photos, special skills, voice)
- You CAN recommend selection if the applicant clearly meets the role requirements based on their submission
- You CAN recommend rejection if the applicant clearly does not match what the role needs
- Be warm, encouraging, and constructive in all feedback

## ROLE BEING CAST
- **Project**: ${input.role.projectTitle}
- **Role**: ${input.role.roleName} (${input.role.roleType})
- **Description**: ${input.role.roleDescription}
- **Requirements**: ${input.role.requirements}
- **Preferred Age Range**: ${input.role.ageRange || 'Any'}
- **Preferred Gender**: ${input.role.gender || 'Any'}

## APPLICANT SUBMISSION
- **Name**: ${input.applicant.fullName}
- **Age**: ${input.applicant.age || 'Not specified'}
- **Gender**: ${input.applicant.gender || 'Not specified'}
- **Special Skills**: ${input.applicant.specialSkills || 'Not specified'}

## PERSONALITY INSIGHTS (from their answers)
- **Self-Description**: ${input.applicant.personality.describe_yourself || 'Not provided'}
- **Why They Want This**: ${input.applicant.personality.why_acting || 'Not provided'}
- **Dream Role**: ${input.applicant.personality.dream_role || 'Not provided'}
- **Unique Quality**: ${input.applicant.personality.unique_quality || 'Not provided'}

## WHAT TO EVALUATE
Based ONLY on what was submitted, assess:
1. How well the applicant's profile (age, gender, skills) aligns with the role requirements
2. How their personality and motivation fit the character
3. Unique qualities or skills that could enhance this role
4. Overall compatibility between the applicant and the role`

    if (hasPhotos) {
        prompt += `
5. **VISUAL ASSESSMENT** (photos are attached): Analyze the applicant's uploaded photos:
   - Screen presence and photogenic quality
   - How well their look matches the character description
   - Expressiveness shown in their photos
   Be respectful and professional. Focus on casting compatibility, not personal appearance judgments.`
    }

    prompt += `\n\nBe encouraging and constructive. This is a volunteer/independent production, so prioritize passion, personality fit, and potential.`

    if (input.locale && input.locale !== 'en') {
        prompt += `\n\n## ⚠️ CRITICAL LANGUAGE REQUIREMENT ⚠️\nThe applicant speaks ${lang}. You MUST write the "applicantFeedback" field entirely in ${lang}.\nDo NOT write applicantFeedback in English under any circumstances — the applicant will not understand it.\nAll other fields (strengths, concerns, notes, visualAssessment) should remain in English for the admin team.\nIMPORTANT: "applicantFeedback" MUST be ${lang} only.`
    }

    if (customPrompt) {
        prompt += `\n\n## ADDITIONAL INSTRUCTIONS FROM CASTING DIRECTOR\n${customPrompt}`
    }

    prompt += `

## OUTPUT FORMAT
Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{
  "overallScore": <0-100>,
  "roleFitScore": <0-100>,
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "concerns": ["area to explore 1", "area to explore 2"],
  "recommendation": "<STRONG_FIT|GOOD_FIT|MODERATE|WEAK_FIT>",
  "notes": "Constructive assessment notes about the applicant's compatibility with the role based on their submission...",
  "applicantFeedback": "A personalized message (2-3 sentences) for the applicant BY NAME. RULES: (1) If they are a GOOD FIT: congratulate them, mention what specifically makes them right for this role based on their submission. (2) If they are NOT a fit: be honest and kind — tell them this particular role isn't the best match for them, but encourage them to explore and apply for other roles on the platform that may suit them better. (3) NEVER suggest they improve their current application, provide more details, or elaborate on answers — they cannot reapply for this role. (4) NEVER advise them to take workshops, classes, or build experience. (5) Keep it warm, direct, and forward-looking."`

    if (hasPhotos) {
        prompt += `,
  "visualAssessment": "A brief assessment (2-3 sentences) of the applicant's photos in relation to the role. Comment on screen presence, look fit, and expressiveness."`
    }

    prompt += `\n}`

    return prompt
}

// Read photo files from disk and return as base64 for vision APIs
async function loadPhotosAsBase64(photoUrls: string[]): Promise<{ base64: string; mimeType: string }[]> {
    const photos: { base64: string; mimeType: string }[] = []
    for (const url of photoUrls.slice(0, 4)) { // Max 4 photos to avoid token limits
        try {
            const filePath = path.join(process.cwd(), 'public', url)
            const buffer = await readFile(filePath)
            const ext = path.extname(url).toLowerCase()
            const mimeType = ext === '.png' ? 'image/png'
                : ext === '.webp' ? 'image/webp'
                : ext === '.gif' ? 'image/gif'
                : 'image/jpeg'
            photos.push({ base64: buffer.toString('base64'), mimeType })
        } catch {
            console.log(`[AI Audit] Could not read photo: ${url}`)
        }
    }
    return photos
}

// ═══ GROQ PROVIDER ═══
async function callGroq(apiKey: string, model: string, prompt: string): Promise<string> {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: 'You are a professional casting director. Respond only with valid JSON.' },
                { role: 'user', content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 1024,
            response_format: { type: 'json_object' },
        }),
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const msg = err?.error?.message || `Groq API error: ${res.status}`
        throw new Error(msg)
    }

    const data = await res.json()
    return data.choices?.[0]?.message?.content || ''
}

// ═══ OPENAI PROVIDER ═══
async function callOpenAI(apiKey: string, model: string, prompt: string): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: 'You are a professional casting director. Respond only with valid JSON.' },
                { role: 'user', content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 1024,
            response_format: { type: 'json_object' },
        }),
    })
    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message || `OpenAI API error: ${res.status}`)
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content || ''
}

// ═══ GEMINI PROVIDER (with vision support) ═══
async function callGemini(apiKey: string, model: string, prompt: string, photos?: { base64: string; mimeType: string }[]): Promise<string> {
    const genAI = new GoogleGenerativeAI(apiKey)
    const aiModel = genAI.getGenerativeModel({ model })

    if (photos && photos.length > 0) {
        // Multimodal: text + images
        const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
            { text: prompt },
            ...photos.map(p => ({ inlineData: { data: p.base64, mimeType: p.mimeType } })),
        ]
        const result = await aiModel.generateContent(parts)
        return result.response.text()
    }

    const result = await aiModel.generateContent(prompt)
    return result.response.text()
}

// ═══ MAIN AGENT WITH RATE-LIMITED ROUND-ROBIN + DAILY QUOTA AWARENESS ═══
export async function runAuditionAgent(input: AuditInput): Promise<AuditReport> {
    // Reset daily exhaustion tracking if we crossed midnight
    checkDailyReset()

    const config = await getAIConfig()

    if (config.keys.length === 0 || !config.keys[0].key) {
        throw new Error('NO_API_KEY: Configure your API key in Admin → Settings → API Keys to enable AI casting analysis. Supports Groq (free & fast) and Google Gemini.')
    }

    // Load applicant photos for vision-capable models
    const hasPhotos = (input.applicant.photoUrls?.length ?? 0) > 0
    let photos: { base64: string; mimeType: string }[] = []
    let irrelevantImageFlag = false
    if (hasPhotos) {
        // Filter out images that appear irrelevant (simple heuristic: filename contains 'irrelevant' or 'placeholder')
        const filteredUrls = input.applicant.photoUrls!.filter(url => {
            const lowered = url.toLowerCase()
            if (lowered.includes('irrelevant') || lowered.includes('placeholder')) {
                irrelevantImageFlag = true
                return false
            }
            return true
        })
        if (filteredUrls.length > 0) {
            photos = await loadPhotosAsBase64(filteredUrls)
            console.log(`[AI Audit] Loaded ${photos.length} relevant photos for visual analysis`)
        } else {
            console.log('[AI Audit] No relevant photos after filtering irrelevant images')
        }
    }

    let lastError = ''

    // Each entry may carry its own provider/model when the key list spans multiple providers
    type KeyEntry = { id: string; key: string; label: string; provider?: string; model?: string }
    const allKeys = config.keys as KeyEntry[]

    // Filter out daily-exhausted keys, sort remainder by RPM capacity (most available first)
    const freshKeys = allKeys
        .filter(k => !dailyExhaustedKeys.has(k.id))
        .sort((a, b) => {
            const pA = (a.provider || config.provider) as string
            const pB = (b.provider || config.provider) as string
            return getRemainingCapacity(b.id, pB) - getRemainingCapacity(a.id, pA)
        })

    console.log(`[AI Audit] ${freshKeys.length}/${allKeys.length} keys available (${dailyExhaustedKeys.size} daily-exhausted)`)

    if (freshKeys.length === 0) {
        throw new Error(
            `All API keys have hit their daily quota. They will reset at midnight UTC. ` +
            `(${allKeys.length} keys checked, all exhausted)`
        )
    }

    // Retry loop: if all fresh keys are at RPM limit, wait briefly and retry
    const MAX_RPM_RETRIES = 3
    for (let retry = 0; retry <= MAX_RPM_RETRIES; retry++) {
        // Re-filter exhausted keys each retry cycle in case new ones hit 429
        const keysThisRound = freshKeys.filter(k => !dailyExhaustedKeys.has(k.id))
        const availableKeys = keysThisRound.filter(k => {
            const p = (k.provider || config.provider) as string
            return hasCapacity(k.id, p)
        })

        if (availableKeys.length === 0 && retry < MAX_RPM_RETRIES) {
            const waitSec = 10 + retry * 5
            console.log(`[AI Audit] All ${keysThisRound.length} keys at RPM limit. Waiting ${waitSec}s (retry ${retry + 1}/${MAX_RPM_RETRIES})...`)
            await new Promise(r => setTimeout(r, waitSec * 1000))
            continue
        }

        const keysToTry = availableKeys.length > 0 ? availableKeys : keysThisRound

        for (const keyInfo of keysToTry) {
            // Skip any key that was exhausted mid-loop
            if (dailyExhaustedKeys.has(keyInfo.id)) {
                console.log(`[AI Audit] Skipping key ${keyInfo.label} (daily quota exhausted)`)
                continue
            }

            const keyProvider = (keyInfo.provider || config.provider) as 'groq' | 'gemini' | 'openai'
            const keyModel = keyInfo.model || config.model
            const remaining = getRemainingCapacity(keyInfo.id, keyProvider)

            if (remaining <= 0) {
                console.log(`[AI Audit] Skipping key ${keyInfo.label} (at RPM limit)`)
                continue
            }

            // Build prompt, adding a note about irrelevant images if needed
            const basePrompt = buildPrompt(input, config.customPrompt, photos.length > 0)
            const prompt = irrelevantImageFlag
                ? `${basePrompt}\n\n[NOTE] The applicant uploaded images that appear irrelevant; they have been excluded from visual analysis.`
                : basePrompt

            try {
                console.log(`[AI Audit] Trying key: ${keyInfo.label} | provider: ${keyProvider} | model: ${keyModel} | RPM left: ${remaining}`)

                // Record the call BEFORE making it (RPM tracking)
                recordKeyUsage(keyInfo.id)

                let responseText: string
                if (keyProvider === 'groq') {
                    const textPrompt = photos.length > 0
                        ? prompt + '\n\n(Note: Applicant uploaded photos but this model cannot analyze images. Evaluate based on text data only and mention photos were not analyzed.)'
                        : prompt
                    responseText = await callGroq(keyInfo.key, keyModel, textPrompt)
                } else if (keyProvider === 'openai') {
                    responseText = await callOpenAI(keyInfo.key, keyModel, prompt)
                } else {
                    responseText = await callGemini(keyInfo.key, keyModel, prompt, photos.length > 0 ? photos : undefined)
                }

                // Record success in DB
                if (keyInfo.id !== 'env' && keyInfo.id !== 'settings') {
                    await prisma.apiKey.update({
                        where: { id: keyInfo.id },
                        data: { usageCount: { increment: 1 }, lastUsed: new Date(), lastError: null },
                    }).catch(() => { /* non-critical */ })
                }

                // Parse JSON from response
                let jsonStr = responseText.trim()
                if (jsonStr.startsWith('```')) {
                    jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim()
                }

                const report: AuditReport = JSON.parse(jsonStr)

                // If irrelevant images were filtered, add a note to the report
                if (irrelevantImageFlag) {
                    report.notes = (report.notes ? report.notes + ' ' : '') + 'Irrelevant images were uploaded and excluded from analysis.'
                }

                // Validate and clamp scores
                report.overallScore = Math.max(0, Math.min(100, Math.round(report.overallScore)))
                report.roleFitScore = Math.max(0, Math.min(100, Math.round(report.roleFitScore)))

                // Apply penalty if irrelevant images were filtered out
                if (irrelevantImageFlag) {
                    const penalty = 5 // points deducted
                    report.overallScore = Math.max(0, report.overallScore - penalty)
                    report.roleFitScore = Math.max(0, report.roleFitScore - penalty)
                    report.notes = (report.notes ? report.notes + ' ' : '') + `Penalty applied: -${penalty} points for irrelevant images.`
                }

                if (!['STRONG_FIT', 'GOOD_FIT', 'MODERATE', 'WEAK_FIT'].includes(report.recommendation)) {
                    report.recommendation = 'MODERATE'
                }

                return report

            } catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error)
                lastError = errMsg
                console.error(`[AI Audit] Key ${keyInfo.label} failed:`, errMsg)

                // If it's a daily quota error, mark this key exhausted and immediately try the next one
                if (isDailyQuotaError(errMsg)) {
                    markDailyExhausted(keyInfo.id)
                    if (keyInfo.id !== 'env' && keyInfo.id !== 'settings') {
                        await prisma.apiKey.update({
                            where: { id: keyInfo.id },
                            data: { lastError: 'Daily quota exhausted (429)', lastUsed: new Date() },
                        }).catch(() => { /* non-critical */ })
                    }
                    // Don't break — continue to next key
                    continue
                }

                // Any other error: log and try next key
                if (keyInfo.id !== 'env' && keyInfo.id !== 'settings') {
                    await prisma.apiKey.update({
                        where: { id: keyInfo.id },
                        data: { lastError: errMsg.slice(0, 200), lastUsed: new Date() },
                    }).catch(() => { /* non-critical */ })
                }
                continue
            }
        }
    }

    const exhaustedCount = dailyExhaustedKeys.size
    throw new Error(
        `All API keys failed for AI Audition. ${exhaustedCount > 0 ? `${exhaustedCount} key(s) hit daily quota. ` : ''}Last error: ${lastError}`
    )
}

/** Get the current rate limit status for monitoring */
export function getRateLimitStatus(): { keyId: string; usageInWindow: number; limit: number; provider: string }[] {
    const status: { keyId: string; usageInWindow: number; limit: number; provider: string }[] = []
    for (const [keyId, timestamps] of keyUsage.entries()) {
        const now = Date.now()
        const recent = timestamps.filter(t => now - t < 60_000)
        status.push({ keyId, usageInWindow: recent.length, limit: 12, provider: 'unknown' })
    }
    return status
}

