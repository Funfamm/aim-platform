import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from '@/lib/db'
import { readFile, stat } from 'fs/promises'
import path from 'path'
import { PUBLIC_BASE_URL, ENABLE_HTTP_FALLBACK } from '@/lib/config'
import { fetchWithTimeout } from '@/lib/http-utils'
import { getAvailableGeminiKey } from './gemini-key'
import { resolveVideoUrl } from '@/lib/videoStorage'

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
        voiceUrl?: string     // Self-tape / voice recording path
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

// ═══ PRE-CHECK RESULT ═══
export interface PreCheckResult {
    ageMismatch: boolean
    ageDetails: string
    genderMismatch: boolean
    genderDetails: string
    voiceMissing: boolean
    voiceDetails: string
    voiceHardRequired: boolean
    totalPenalty: number
    preNotes: string[]
    preConcerns: string[]
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
    screeningSkipped?: boolean // true when Gemini vision key is missing and photos are unvalidated
    warnings?: string[]        // Fallback or file loading warnings
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

function buildPrompt(input: AuditInput, customPrompt: string, hasPhotos: boolean, preCheck: PreCheckResult, hasAudioAttached: boolean): string {
    const lang = LOCALE_NAMES[input.locale || 'en'] || 'English'
    const hasVoice = !!input.applicant.voiceUrl && !preCheck.voiceMissing

    let prompt = `You are the AI assessment assistant for AIM Studio, an AI-powered film production company.

Your task is to analyze a casting applicant's submission and generate a structured compatibility report.

## INTEGRITY RULES — READ FIRST
- If the photos submitted do not appear to show the applicant themselves (e.g. celebrities, stock images, animals, objects), you MUST flag this in concerns and reduce the score significantly.
- If personality answers are copy-pasted, generic, or clearly do not match the role, flag them.
- If the applicant's age or gender clearly falls outside the stated role requirements, this MUST be listed as a concern and reflected in a lower score.
- Do NOT evaluate or comment on the applicant's past experience or acting history.
- Base your evaluation ONLY on the submission provided (personality answers, photos, skills, voice).
- You CAN recommend rejection if the applicant clearly does not match what the role needs.
- Be warm and constructive, but always honest.

## ROLE BEING CAST
- **Project**: ${input.role.projectTitle}
- **Role**: ${input.role.roleName} (${input.role.roleType})
- **Description**: ${input.role.roleDescription}
- **Requirements**: ${input.role.requirements}
- **Required Age Range**: ${input.role.ageRange || 'Any'}
- **Required Gender**: ${input.role.gender || 'Any'}

## APPLICANT SUBMISSION
- **Name**: ${input.applicant.fullName}
- **Age**: ${input.applicant.age || 'Not specified'}${preCheck.ageMismatch ? ' ⚠️ OUTSIDE ROLE AGE RANGE' : ''}
- **Gender**: ${input.applicant.gender || 'Not specified'}${preCheck.genderMismatch ? ' ⚠️ DOES NOT MATCH ROLE GENDER REQUIREMENT' : ''}
- **Special Skills**: ${input.applicant.specialSkills || 'Not specified'}
- **Voice/Self-Tape**: ${hasVoice ? (hasAudioAttached ? 'Submitted ✓ (audio attached below — LISTEN to it)' : 'Submitted ✓ (file on server but not attached)') : 'NOT SUBMITTED ⚠️'}

## PERSONALITY INSIGHTS (from their answers)
- **Self-Description**: ${input.applicant.personality.describe_yourself || 'Not provided'}
- **Why They Want This**: ${input.applicant.personality.why_acting || 'Not provided'}
- **Dream Role**: ${input.applicant.personality.dream_role || 'Not provided'}
- **Unique Quality**: ${input.applicant.personality.unique_quality || 'Not provided'}

## WHAT TO EVALUATE
Based ONLY on what was submitted, assess:
1. How well the applicant's profile (age, gender, skills) aligns with the role requirements — flag any hard mismatches
2. How their personality and motivation fit the character — note if answers feel generic or irrelevant
3. Unique qualities or skills that could enhance this role
4. Overall integrity and completeness of the submission (missing voice, mismatched photos, etc.)
5. Overall compatibility between the applicant and the role`

    if (hasPhotos) {
        prompt += `
6. **VISUAL ASSESSMENT** (photos are attached — verify they show the actual applicant):
   - Confirm the photos appear to show a real person (not stock photos, celebrities, or AI-generated faces)
   - Screen presence and photogenic quality
   - How well their look matches the character description
   - Expressiveness shown in their photos
   - Flag any photos that seem suspicious or irrelevant
   Be respectful and professional. Focus on casting compatibility, not personal appearance judgments.`
    }

    if (hasAudioAttached) {
        const nextNum = hasPhotos ? 7 : 6
        prompt += `
${nextNum}. **VOICE/AUDIO ASSESSMENT** (audio recording is attached — LISTEN to it carefully):
   - Vocal quality: clarity, tone, warmth, energy
   - Delivery: confidence, expressiveness, emotional range
   - How their voice fits the character they're auditioning for
   - Any accent or speech patterns relevant to the role
   - Overall impression of their vocal presence and charisma
   Factor this voice assessment into your overallScore and roleFitScore. A strong voice performance should boost scores.`
    }

    if (preCheck.preNotes.length > 0) {
        prompt += `\n\n## ⚠️ SYSTEM PRE-CHECK ALERTS (factor these into your scoring)\n${preCheck.preNotes.map(n => `- ${n}`).join('\n')}`
    }

    prompt += `\n\nThis is a volunteer/independent production — prioritize passion and personality fit, but maintain submission integrity standards.`

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
  "concerns": ["concern 1", "concern 2"],
  "recommendation": "<STRONG_FIT|GOOD_FIT|MODERATE|WEAK_FIT>",
  "notes": "Admin-facing assessment notes about compatibility, submission quality, and any integrity flags...",
  "applicantFeedback": "A personalized message (2-3 sentences) for the applicant BY NAME. RULES: (1) GOOD FIT: congratulate them, mention what specifically makes them right for this role. (2) NOT a fit: be honest and kind — this role isn't the best match, but encourage them to apply for other roles on the platform. (3) NEVER suggest they improve or re-submit — they cannot reapply. (4) NEVER advise workshops or classes. (5) Keep it warm, direct, and forward-looking."`

    if (hasPhotos) {
        prompt += `,
  "visualAssessment": "Assessment of the applicant's photos: confirm they appear to be the real applicant, comment on screen presence, look match for the role, and any concerns."`
    }

    if (hasAudioAttached) {
        prompt += `,
  "voiceAssessment": "Assessment of the applicant's voice recording: vocal quality, delivery, expressiveness, accent, and how well their voice fits this character."`
    }

    prompt += `\n}`

    return prompt
}

// ═══ PRE-CHECK HELPERS ═══

/** Parse an age range string like "18-35", "25+", "under 40" → [min, max] or null */
export function parseAgeRange(ageRange: string | null): [number, number] | null {
    if (!ageRange) return null
    const s = ageRange.trim()
    // "18-35" or "18 - 35"
    const rangeMatch = s.match(/(\d+)\s*[-–]\s*(\d+)/)
    if (rangeMatch) return [parseInt(rangeMatch[1]), parseInt(rangeMatch[2])]
    // "25+" or "25 and above"
    const plusMatch = s.match(/(\d+)\s*\+/)
    if (plusMatch) return [parseInt(plusMatch[1]), 120]
    // "under 40" or "maximum 40"
    const underMatch = s.match(/(?:under|max(?:imum)?|up to)\s*(\d+)/i)
    if (underMatch) return [0, parseInt(underMatch[1])]
    // Single number "30"
    const single = s.match(/^(\d+)$/)
    if (single) { const n = parseInt(single[1]); return [n - 5, n + 5] }
    return null
}

/** Normalise a gender string to a canonical form for comparison */
export function normaliseGender(g: string | null): string {
    if (!g) return 'any'
    const lower = g.toLowerCase().trim()
    if (['male', 'man', 'men', 'm'].includes(lower)) return 'male'
    if (['female', 'woman', 'women', 'f'].includes(lower)) return 'female'
    return 'any'
}

/**
 * Pure function: Apply pre-check penalties and recommendation caps to an AuditReport.
 * Extracted for testability — mirrors the inline logic in runAuditionAgent().
 */
export function applyPreCheckPenalties(
    report: AuditReport,
    preCheck: PreCheckResult
): AuditReport {
    const r = { ...report, concerns: [...(report.concerns || [])] }

    // Clamp raw scores
    r.overallScore = Math.max(0, Math.min(100, Math.round(r.overallScore)))
    r.roleFitScore = Math.max(0, Math.min(100, Math.round(r.roleFitScore)))

    if (preCheck.totalPenalty > 0) {
        r.overallScore = Math.max(0, r.overallScore - preCheck.totalPenalty)
        r.roleFitScore = Math.max(0, r.roleFitScore - preCheck.totalPenalty)
        r.concerns = [...r.concerns, ...preCheck.preConcerns.filter(c => !r.concerns.includes(c))]

        // Hard cap recommendation if critical mismatches
        if (preCheck.ageMismatch || preCheck.genderMismatch) {
            if (r.recommendation === 'STRONG_FIT') r.recommendation = 'MODERATE'
            else if (r.recommendation === 'GOOD_FIT') r.recommendation = 'MODERATE'
        }

        // Voice hard requirement: cap at WEAK_FIT
        if (preCheck.voiceHardRequired && preCheck.voiceMissing) {
            r.recommendation = 'WEAK_FIT'
            const hardNote = 'A voice/self-tape recording is required for this role and was not submitted. This is a disqualifying factor.'
            if (!r.concerns.includes(hardNote)) {
                r.concerns = [...r.concerns, hardNote]
            }
        }
    }

    // Normalize invalid recommendations
    if (!['STRONG_FIT', 'GOOD_FIT', 'MODERATE', 'WEAK_FIT'].includes(r.recommendation)) {
        r.recommendation = 'MODERATE'
    }

    return r
}

/** Run all pre-checks and return a consolidated result */
async function runPreChecks(input: AuditInput, warnings: string[]): Promise<PreCheckResult> {
    const result: PreCheckResult = {
        ageMismatch: false, ageDetails: '',
        genderMismatch: false, genderDetails: '',
        voiceMissing: false, voiceDetails: '',
        voiceHardRequired: false,
        totalPenalty: 0,
        preNotes: [],
        preConcerns: [],
    }

    // Load site settings once for voice requirement
    const settings = await prisma.siteSettings.findFirst()
    const requireVoice = settings?.requireVoice ?? false

    // ── Age range check ──
    const range = parseAgeRange(input.role.ageRange)
    if (range && input.applicant.age !== null) {
        const [minAge, maxAge] = range
        if (input.applicant.age < minAge || input.applicant.age > maxAge) {
            result.ageMismatch = true
            result.ageDetails = `Applicant age ${input.applicant.age} is outside the required range ${input.role.ageRange}`
            result.totalPenalty += 20
            result.preNotes.push(`AGE MISMATCH: ${result.ageDetails}`)
            result.preConcerns.push(result.ageDetails)
            console.warn(`[AI Audit] Pre-check: ${result.ageDetails}`)
        }
    }

    // ── Gender check ──
    const roleGender = normaliseGender(input.role.gender)
    const applicantGender = normaliseGender(input.applicant.gender)
    if (roleGender !== 'any' && applicantGender !== 'any' && roleGender !== applicantGender) {
        result.genderMismatch = true
        result.genderDetails = `Applicant gender (${input.applicant.gender}) does not match role requirement (${input.role.gender})`
        result.totalPenalty += 15
        result.preNotes.push(`GENDER MISMATCH: ${result.genderDetails}`)
        result.preConcerns.push(result.genderDetails)
        console.warn(`[AI Audit] Pre-check: ${result.genderDetails}`)
    }

    // ── Voice / self-tape check ──
    if (input.applicant.voiceUrl) {
        try {
            if (input.applicant.voiceUrl.startsWith('http')) {
                result.voiceDetails = `Voice file present (remote URL)`
            } else {
                const filePath = path.join(process.cwd(), 'public', input.applicant.voiceUrl)
                let fileSize = 0
                try {
                    const fileStat = await stat(filePath)
                    fileSize = fileStat.size
                } catch (err) {
                    if (ENABLE_HTTP_FALLBACK) {
                        const fullUrl = PUBLIC_BASE_URL + (input.applicant.voiceUrl.startsWith('/') ? '' : '/') + input.applicant.voiceUrl
                        const res = await fetchWithTimeout(fullUrl, { method: 'HEAD' })
                        if (!res.ok) throw err
                        fileSize = parseInt(res.headers.get('content-length') || '2048', 10)
                        console.log(`[AI Audit] HTTP Fallback succeeded for voice file: ${fullUrl}`)
                    } else {
                        throw err
                    }
                }

                if (fileSize < 1024) { // < 1 KB — essentially empty
                    result.voiceMissing = true
                    result.voiceDetails = 'Voice/self-tape file appears to be empty or corrupt'
                    result.totalPenalty += requireVoice ? 25 : 8
                    result.preNotes.push(`VOICE ISSUE: ${result.voiceDetails}`)
                    result.preConcerns.push('Voice recording appears to be empty — please resubmit')
                    warnings.push(`Voice file is empty or corrupt`)
                } else {
                    result.voiceDetails = `Voice file present (${Math.round(fileSize / 1024)} KB)`
                }
            }
        } catch {
            result.voiceMissing = true
            result.voiceDetails = 'Voice/self-tape file could not be found on server'
            result.totalPenalty += requireVoice ? 25 : 8
            result.preNotes.push(`VOICE MISSING: ${result.voiceDetails}`)
            result.preConcerns.push('Voice/self-tape recording could not be located')
            warnings.push(`Voice/self-tape recording could not be located`)
        }
    } else {
        result.voiceMissing = true
        result.voiceDetails = 'No voice/self-tape recording submitted'
        result.totalPenalty += requireVoice ? 25 : 5
        result.preNotes.push('No voice/self-tape recording was submitted')
        result.preConcerns.push('Missing voice recording — applicant did not submit a self-tape')
    }

    // Flag hard requirement so the caller can cap recommendation
    result.voiceHardRequired = requireVoice

    return result
}

// Read photo files from disk and return as base64 for vision APIs
async function loadPhotosAsBase64(photoUrls: string[], warnings: string[]): Promise<{ base64: string; mimeType: string; url: string }[]> {
    const photos: { base64: string; mimeType: string; url: string }[] = []
    for (const url of photoUrls.slice(0, 4)) {
        try {
            let buffer: Buffer
            const resolvedUrl = await resolveVideoUrl(url)
            
            if (resolvedUrl.startsWith('http')) {
                const res = await fetchWithTimeout(resolvedUrl)
                if (!res.ok) throw new Error('Failed to fetch remote photo')
                buffer = Buffer.from(await res.arrayBuffer())
            } else {
                const filePath = path.join(process.cwd(), 'public', resolvedUrl)
                try {
                    buffer = await readFile(filePath)
                } catch (err) {
                    if (!ENABLE_HTTP_FALLBACK) throw err
                    const fullUrl = PUBLIC_BASE_URL + (resolvedUrl.startsWith('/') ? '' : '/') + resolvedUrl
                    const res = await fetchWithTimeout(fullUrl)
                    if (!res.ok) throw err
                    buffer = Buffer.from(await res.arrayBuffer())
                    console.log(`[AI Audit] HTTP Fallback succeeded for photo: ${fullUrl}`)
                }
            }
            const ext = path.extname(url).toLowerCase()
            const mimeType = ext === '.png' ? 'image/png'
                : ext === '.webp' ? 'image/webp'
                : ext === '.gif' ? 'image/gif'
                : 'image/jpeg'
            photos.push({ base64: buffer.toString('base64'), mimeType, url })
        } catch {
            console.warn(`[AI Audit] Could not read photo: ${url}`)
            warnings.push(`Photo ${url.split('/').pop()} could not be located`)
        }
    }
    return photos
}

// Read voice/audio file from disk and return as base64 for Gemini audio analysis
const AUDIO_MIME_MAP: Record<string, string> = {
    '.mp3': 'audio/mpeg', '.mp4': 'audio/mp4', '.m4a': 'audio/mp4',
    '.wav': 'audio/wav', '.webm': 'audio/webm', '.ogg': 'audio/ogg',
}
const MAX_AUDIO_INLINE_SIZE = 18 * 1024 * 1024 // 18 MB — leave headroom for the 20 MB API limit

async function loadAudioAsBase64(voiceUrl: string, warnings: string[]): Promise<{ base64: string; mimeType: string } | null> {
    try {
        let buffer: Buffer
        let fileStat: { size: number } | null = null
        let mimeType = 'audio/webm'
        const resolvedUrl = await resolveVideoUrl(voiceUrl)

        if (resolvedUrl.startsWith('http')) {
            const res = await fetchWithTimeout(resolvedUrl)
            if (!res.ok) throw new Error('Failed to fetch audio url')
            const arrayBuffer = await res.arrayBuffer()
            buffer = Buffer.from(arrayBuffer)
            fileStat = { size: buffer.length }
            mimeType = res.headers.get('content-type') || 'audio/webm'
        } else {
            const filePath = path.join(process.cwd(), 'public', resolvedUrl)
            try {
                fileStat = await stat(filePath)
                if (fileStat.size < 1024) throw new Error(`Audio file too small (${fileStat.size} bytes)`)
                buffer = await readFile(filePath)
            } catch (err) {
                if (!ENABLE_HTTP_FALLBACK) throw err
                const fullUrl = PUBLIC_BASE_URL + (resolvedUrl.startsWith('/') ? '' : '/') + resolvedUrl
                const res = await fetchWithTimeout(fullUrl)
                if (!res.ok) throw err
                const arrayBuffer = await res.arrayBuffer()
                buffer = Buffer.from(arrayBuffer)
                fileStat = { size: buffer.length }
                console.log(`[AI Audit] HTTP Fallback succeeded for audio: ${fullUrl}`)
            }
        }

        if (fileStat.size > MAX_AUDIO_INLINE_SIZE) {
            console.log(`[AI Audit] Audio file too large for inline (${Math.round(fileStat.size / 1024 / 1024)} MB), skipping: ${voiceUrl}`)
            warnings.push(`Voice recording is too large for AI analysis`)
            return null
        }
        const ext = path.extname(voiceUrl).toLowerCase()
        if (AUDIO_MIME_MAP[ext]) mimeType = AUDIO_MIME_MAP[ext]
        console.log(`[AI Audit] Loaded audio for analysis: ${voiceUrl} (${Math.round(fileStat.size / 1024)} KB, ${mimeType})`)
        return { base64: buffer.toString('base64'), mimeType }
    } catch (err) {
        console.warn(`[AI Audit] Could not load audio file: ${voiceUrl}`, err)
        return null
    }
}

/**
 * Vision pre-screen: asks Gemini to describe each image and classify it.
 * Uses a rich prompt asking for a description + verdict to prevent easy bypass.
 * Returns approved photos and flags any that don't contain a real human.
 */
async function screenPhotosForRelevance(
    photos: { base64: string; mimeType: string; url: string }[],
    geminiKeys: { id: string; key: string; label: string; model?: string }[],
    defaultModel: string
): Promise<{ approved: { base64: string; mimeType: string }[]; hadIrrelevant: boolean; rejectedCount: number; rejectionReasons: string[] }> {
    if (photos.length === 0) return { approved: [], hadIrrelevant: false, rejectedCount: 0, rejectionReasons: [] }

    const { GoogleGenerativeAI } = await import('@google/generative-ai')

    const approved: { base64: string; mimeType: string }[] = []
    const rejectionReasons: string[] = []
    let rejectedCount = 0

    for (let i = 0; i < photos.length; i++) {
        const photo = photos[i]

        // ── Key rotation: pick the Gemini key with most RPM headroom ──
        const availableKeys = geminiKeys
            .filter(k => !dailyExhaustedKeys.has(k.id) && hasCapacity(k.id, 'gemini'))
            .sort((a, b) => getRemainingCapacity(b.id, 'gemini') - getRemainingCapacity(a.id, 'gemini'))

        if (availableKeys.length === 0) {
            // All keys at limit — pass remaining photos through unscreened
            console.warn(`[AI Audit] All Gemini keys at RPM limit — passing photo ${i + 1} unscreened`)
            approved.push({ base64: photo.base64, mimeType: photo.mimeType })
            continue
        }

        const keyInfo = availableKeys[0]
        const model = keyInfo.model || defaultModel

        try {
            recordKeyUsage(keyInfo.id)
            console.log(`[AI Audit] Screening photo ${i + 1}/${photos.length} with key: ${keyInfo.label} (RPM left: ${getRemainingCapacity(keyInfo.id, 'gemini')})`)

            const genAI = new GoogleGenerativeAI(keyInfo.key)
            const aiModel = genAI.getGenerativeModel({ model })

            const result = await aiModel.generateContent([
                {
                    text: `You are a casting submission validator.

Look at this image and answer the following questions:
1. What does this image show? (describe in one sentence)
2. Does it contain a real human person (face or body)? YES or NO
3. If YES — does the person appear to be a genuine applicant photo (not a stock image, celebrity, AI-generated face, or meme)? YES or NO
4. If anything seems suspicious or irrelevant, describe it.

End your response with a single verdict line:
VERDICT: PASS — if the image is a genuine human applicant photo
VERDICT: FAIL — if it is not (animal, object, scenery, stock photo, celebrity, cartoon, meme, etc.)

Be strict. An applicant should not be able to pass by submitting a picture of a dog, a landscape, a movie character, or someone else.`
                },
                {
                    inlineData: { data: photo.base64, mimeType: photo.mimeType }
                }
            ])
            const answer = result.response.text().trim()
            const verdictLine = answer.split('\n').reverse().find(l => l.includes('VERDICT:')) || ''
            const passed = verdictLine.includes('PASS')

            if (passed) {
                approved.push({ base64: photo.base64, mimeType: photo.mimeType })
                console.log(`[AI Audit] ✓ Photo passed screening: ${photo.url}`)
            } else {
                rejectedCount++
                const descLine = answer.split('\n')[0]?.replace(/^1\.\s*/, '').trim() || 'Non-human content detected'
                rejectionReasons.push(descLine)
                console.warn(`[AI Audit] ✗ Photo REJECTED: ${photo.url} — Gemini: ${descLine}`)
            }
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err)
            // If daily quota hit, mark key exhausted and retry this photo with next key
            if (isDailyQuotaError(errMsg)) {
                markDailyExhausted(keyInfo.id)
                i-- // retry this photo with next available key
                continue
            }
            // Screening failed — allow through (fail-open) but log
            console.warn(`[AI Audit] Photo screening error for ${photo.url}:`, err)
            approved.push({ base64: photo.base64, mimeType: photo.mimeType })
        }
    }

    return { approved, hadIrrelevant: rejectedCount > 0, rejectedCount, rejectionReasons }
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

// ═══ GEMINI PROVIDER (with vision + audio support) ═══
async function callGemini(
    apiKey: string,
    model: string,
    prompt: string,
    photos?: { base64: string; mimeType: string }[],
    audio?: { base64: string; mimeType: string } | null
): Promise<string> {
    const genAI = new GoogleGenerativeAI(apiKey)
    const aiModel = genAI.getGenerativeModel({ model })

    const hasMedia = (photos && photos.length > 0) || audio

    if (hasMedia) {
        // Multimodal: text + images + audio
        const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
            { text: prompt },
        ]
        if (photos) {
            parts.push(...photos.map(p => ({ inlineData: { data: p.base64, mimeType: p.mimeType } })))
        }
        if (audio) {
            parts.push({ inlineData: { data: audio.base64, mimeType: audio.mimeType } })
            console.log(`[AI Audit] Sending audio to Gemini (${audio.mimeType})`)
        }
        const result = await aiModel.generateContent(parts)
        return result.response.text()
    }

    const result = await aiModel.generateContent(prompt)
    return result.response.text()
}

// ═══ MAIN AGENT WITH RATE-LIMITED ROUND-ROBIN + DAILY QUOTA AWARENESS ═══
export async function runAuditionAgent(input: AuditInput): Promise<AuditReport> {
    const warnings: string[] = []

    // Reset daily exhaustion tracking if we crossed midnight
    checkDailyReset()

    const config = await getAIConfig()

    if (config.keys.length === 0 || !config.keys[0].key) {
        throw new Error('NO_API_KEY: Configure your API key in Admin → Settings → API Keys to enable AI casting analysis. Supports Groq (free & fast) and Google Gemini.')
    }

    // ── Run pre-checks (age, gender, voice) before any AI call ──
    const preCheck = await runPreChecks(input, warnings)
    if (preCheck.totalPenalty > 0) {
        console.warn(`[AI Audit] Pre-checks flagged issues: penalty=${preCheck.totalPenalty}pts | ${preCheck.preNotes.join('; ')}`)
    }

    // ── Load applicant photos and run AI vision pre-screen ──
    const hasPhotos = (input.applicant.photoUrls?.length ?? 0) > 0
    let photos: { base64: string; mimeType: string }[] = []
    let irrelevantImageFlag = false
    let rejectedPhotoCount = 0
    let photoRejectionReasons: string[] = []

    let screeningSkipped = false
    if (hasPhotos) {
        const rawPhotos = await loadPhotosAsBase64(input.applicant.photoUrls!, warnings)
        console.log(`[AI Audit] Loaded ${rawPhotos.length} photo(s) for screening`)

        // Collect ALL Gemini keys for rotation during photo screening
        type KeyEntry = { id: string; key: string; label: string; provider?: string; model?: string }
        const geminiKeys = (config.keys as KeyEntry[])
            .filter(k => (k.provider === 'gemini' || !k.provider) && !dailyExhaustedKeys.has(k.id))
            .map(k => ({ id: k.id, key: k.key, label: k.label, model: k.model }))
        
        const defaultGeminiModel = geminiKeys[0]?.model || 'gemini-2.5-flash'

        if (geminiKeys.length === 0) {
            console.log(`[AI Audit] No Gemini keys explicitly assigned to 'audition'. Querying fallback keys...`)
            const fallbackKey = await getAvailableGeminiKey(dailyExhaustedKeys, 'audition')
            if (fallbackKey) {
                geminiKeys.push(fallbackKey)
                console.log(`[AI Audit] Used fallback Gemini key: ${fallbackKey.label}`)
            }
        }

        if (geminiKeys.length > 0 && rawPhotos.length > 0) {
            console.log(`[AI Audit] ${geminiKeys.length} Gemini key(s) available for photo screening rotation`)
            const screening = await screenPhotosForRelevance(rawPhotos, geminiKeys, defaultGeminiModel)
            photos = screening.approved
            irrelevantImageFlag = screening.hadIrrelevant
            rejectedPhotoCount = screening.rejectedCount
            photoRejectionReasons = screening.rejectionReasons
            if (irrelevantImageFlag) {
                console.warn(`[AI Audit] ⚠️ ${rejectedPhotoCount} photo(s) rejected — ${photoRejectionReasons.join('; ')}`)
            }
        } else {
            photos = rawPhotos.map(p => ({ base64: p.base64, mimeType: p.mimeType }))
            console.log('[AI Audit] No Gemini keys (or no photos) for vision screening — photos passed through unvalidated')
            screeningSkipped = true
            warnings.push('Vision screening was skipped — photos were not validated by AI')
        }
    }

    // ── Load voice/audio recording for AI analysis (Gemini only) ──
    let audioData: { base64: string; mimeType: string } | null = null
    if (input.applicant.voiceUrl && !preCheck.voiceMissing) {
        audioData = await loadAudioAsBase64(input.applicant.voiceUrl, warnings)
        if (audioData) {
            console.log(`[AI Audit] Audio loaded for AI analysis (${audioData.mimeType})`)
        } else {
            console.log(`[AI Audit] Audio file could not be loaded — AI will evaluate without it`)
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

            // Build prompt — pre-check alerts are baked into the prompt itself
            const hasAudioForAI = !!audioData && keyProvider === 'gemini'
            const prompt = buildPrompt(input, config.customPrompt, photos.length > 0, preCheck, hasAudioForAI)

            try {
                console.log(`[AI Audit] Trying key: ${keyInfo.label} | provider: ${keyProvider} | model: ${keyModel} | RPM left: ${remaining}`)

                // Record the call BEFORE making it (RPM tracking)
                recordKeyUsage(keyInfo.id)

                let responseText: string
                if (keyProvider === 'groq') {
                    let textPrompt = prompt
                    if (photos.length > 0) textPrompt += '\n\n(Note: Applicant uploaded photos but this model cannot analyze images. Evaluate based on text data only and mention photos were not analyzed.)'
                    if (audioData) textPrompt += '\n\n(Note: Applicant uploaded a voice/self-tape recording but this model cannot analyze audio. Evaluate based on text data only.)'
                    responseText = await callGroq(keyInfo.key, keyModel, textPrompt)
                } else if (keyProvider === 'openai') {
                    let textPrompt = prompt
                    if (audioData) textPrompt += '\n\n(Note: Applicant uploaded a voice/self-tape recording but this model cannot analyze audio. Evaluate based on text data only.)'
                    responseText = await callOpenAI(keyInfo.key, keyModel, textPrompt)
                } else {
                    // Gemini: send photos + audio as multimodal inline data
                    responseText = await callGemini(
                        keyInfo.key, keyModel, prompt,
                        photos.length > 0 ? photos : undefined,
                        audioData
                    )
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

                let report: AuditReport = JSON.parse(jsonStr)
        // Apply vision‑fallback penalty if screening was skipped
        if (screeningSkipped) {
            report.overallScore = Math.max(0, report.overallScore - 5)
            report.roleFitScore = Math.max(0, report.roleFitScore - 5)
            report.screeningSkipped = true
        }

                // ── Validate and clamp raw LLM scores ──
                report.overallScore = Math.max(0, Math.min(100, Math.round(report.overallScore)))
                report.roleFitScore = Math.max(0, Math.min(100, Math.round(report.roleFitScore)))

                // ── Apply pre-check server-side penalty (age/gender/voice) ──
                if (preCheck.totalPenalty > 0) {
                    report.overallScore = Math.max(0, report.overallScore - preCheck.totalPenalty)
                    report.roleFitScore = Math.max(0, report.roleFitScore - preCheck.totalPenalty)
                    report.concerns = [...(report.concerns || []), ...preCheck.preConcerns.filter(c => !report.concerns?.includes(c))]
                    // Hard cap recommendation if critical mismatches
                    if (preCheck.ageMismatch || preCheck.genderMismatch) {
                        if (report.recommendation === 'STRONG_FIT') report.recommendation = 'MODERATE'
                        else if (report.recommendation === 'GOOD_FIT') report.recommendation = 'MODERATE'
                    }
                    // Voice hard requirement: cap at WEAK_FIT
                    if (preCheck.voiceHardRequired && preCheck.voiceMissing) {
                        report.recommendation = 'WEAK_FIT'
                        const hardNote = 'A voice/self-tape recording is required for this role and was not submitted. This is a disqualifying factor.'
                        if (!report.concerns?.includes(hardNote)) {
                            report.concerns = [...(report.concerns || []), hardNote]
                        }
                    }
                }

                // ── Apply photo rejection penalty ──
                if (irrelevantImageFlag) {
                    const photoPenalty = Math.min(30, rejectedPhotoCount * 12)
                    report.overallScore = Math.max(0, report.overallScore - photoPenalty)
                    report.roleFitScore = Math.max(0, report.roleFitScore - photoPenalty)
                    const reasons = photoRejectionReasons.length > 0 ? ` (detected: ${photoRejectionReasons.join('; ')})` : ''
                    const rejNote = `${rejectedPhotoCount} uploaded photo(s) did not pass content screening${reasons}. These were excluded from visual assessment. Score penalised by ${photoPenalty} points.`
                    report.notes = (report.notes ? report.notes + ' ' : '') + rejNote
                    if (report.applicantFeedback) {
                        report.applicantFeedback += ` Note: one or more of your submitted photos could not be verified as showing a person and were excluded from the visual assessment.`
                    }
                    const photoConcern = `${rejectedPhotoCount} photo(s) did not appear to contain the applicant — please submit clear headshots.`
                    if (!report.concerns?.includes(photoConcern)) {
                        report.concerns = [...(report.concerns || []), photoConcern]
                    }
                    if (report.recommendation === 'STRONG_FIT') report.recommendation = 'GOOD_FIT'
                    if (report.recommendation === 'GOOD_FIT' && rejectedPhotoCount >= 2) report.recommendation = 'MODERATE'
                    if (rejectedPhotoCount >= 3) report.recommendation = 'WEAK_FIT'
                }

                if (!['STRONG_FIT', 'GOOD_FIT', 'MODERATE', 'WEAK_FIT'].includes(report.recommendation)) {
                    report.recommendation = 'MODERATE'
                }

                report.warnings = warnings

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

