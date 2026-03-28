import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

/* eslint-disable @typescript-eslint/no-explicit-any */

async function isAdmin() {
    try { await requireAdmin(); return true } catch { return false }
}

// ─── All supported platform languages (excluding English source) ──────────────
const ALL_LANGS = ['ar', 'de', 'es', 'fr', 'hi', 'ja', 'ko', 'pt', 'ru', 'zh']

const LANG_NAMES: Record<string, string> = {
    ar: 'Arabic', de: 'German', es: 'Spanish', fr: 'French',
    hi: 'Hindi', ja: 'Japanese', ko: 'Korean', pt: 'Portuguese (Brazil)',
    ru: 'Russian', zh: 'Chinese (Simplified)',
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Daily quota tracking ─────────────────────────────────────────────────────
const dailyExhaustedKeys = new Set<string>()
let lastResetDay = new Date().toISOString().slice(0, 10)

function checkDailyReset() {
    const today = new Date().toISOString().slice(0, 10)
    if (today !== lastResetDay) { dailyExhaustedKeys.clear(); lastResetDay = today }
}

function isDailyQuotaError(msg: string): boolean {
    return msg.includes('429') && (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('rate limit'))
}
// ─────────────────────────────────────────────────────────────────────────────

async function callAI(prompt: string): Promise<string> {
    checkDailyReset()
    const settings = await prisma.siteSettings.findFirst()
    let keys = await prisma.apiKey.findMany({
        where: { isActive: true, assignedAgent: { in: ['training', 'all'] } },
        orderBy: [{ lastUsed: 'asc' }, { usageCount: 'asc' }],
    })
    if (keys.length === 0) keys = await prisma.apiKey.findMany({ where: { isActive: true }, orderBy: [{ lastUsed: 'asc' }] })
    if (keys.length === 0 && settings?.geminiApiKey) keys = [{ id: 'settings', key: settings.geminiApiKey, label: 'Settings Key', provider: 'gemini' } as any]
    if (keys.length === 0) throw new Error('No API keys configured.')

    const model = settings?.aiModel || 'gemini-2.5-flash'
    const freshKeys = keys.filter((k: any) => !dailyExhaustedKeys.has(k.id))
    if (freshKeys.length === 0) throw new Error('All API keys hit daily quota. Try again after midnight UTC.')

    const errors: string[] = []
    for (const keyInfo of freshKeys) {
        if (dailyExhaustedKeys.has(keyInfo.id)) continue
        try {
            const provider = keyInfo.provider || 'gemini'
            let responseText = ''

            if (provider === 'gemini') {
                const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyInfo.key}`,
                    { method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.3 } }) }
                )
                const resText = await res.text()
                if (!res.ok) {
                    const msg = `Gemini error (${res.status}): ${resText.slice(0, 200)}`
                    errors.push(msg)
                    if (isDailyQuotaError(`${res.status} ${resText}`)) dailyExhaustedKeys.add(keyInfo.id)
                    continue
                }
                const data = JSON.parse(resText)
                responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
            } else if (provider === 'groq') {
                const groqModel = model.startsWith('gemini') ? 'llama-3.3-70b-versatile' : model
                const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keyInfo.key}` },
                    body: JSON.stringify({ model: groqModel, messages: [{ role: 'user', content: prompt }], temperature: 0.3, response_format: { type: 'json_object' } }),
                })
                if (!res.ok) { const t = await res.text(); const msg = `Groq error (${res.status})`; errors.push(msg); if (isDailyQuotaError(`${res.status} ${t}`)) dailyExhaustedKeys.add(keyInfo.id); continue }
                const data = await res.json()
                responseText = data.choices?.[0]?.message?.content || ''
            } else if (provider === 'openai') {
                const openaiModel = model.startsWith('gemini') || model.startsWith('llama') ? 'gpt-4o-mini' : model
                const res = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keyInfo.key}` },
                    body: JSON.stringify({ model: openaiModel, messages: [{ role: 'user', content: prompt }], temperature: 0.3, response_format: { type: 'json_object' } }),
                })
                if (!res.ok) { const t = await res.text(); const msg = `OpenAI error (${res.status})`; errors.push(msg); if (isDailyQuotaError(`${res.status} ${t}`)) dailyExhaustedKeys.add(keyInfo.id); continue }
                const data = await res.json()
                responseText = data.choices?.[0]?.message?.content || ''
            }

            if (!responseText) { errors.push(`${provider}: empty response`); continue }

            if (keyInfo.id !== 'settings') {
                await prisma.apiKey.update({ where: { id: keyInfo.id }, data: { usageCount: { increment: 1 }, lastUsed: new Date(), lastError: null } }).catch(() => {})
            }
            return responseText
        } catch (err) {
            const msg = String(err instanceof Error ? err.message : err)
            errors.push(msg)
            if (isDailyQuotaError(msg)) dailyExhaustedKeys.add(keyInfo.id)
        }
    }
    throw new Error(`All keys failed: ${errors.slice(-2).join(' | ')}`)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the list of language codes that are missing from the translations JSON */
function getMissingLangs(translationsJson: string | null): string[] {
    if (!translationsJson) return ALL_LANGS
    try {
        const t = JSON.parse(translationsJson)
        return ALL_LANGS.filter(l => !t[l] || Object.keys(t[l]).length === 0)
    } catch { return ALL_LANGS }
}

function mergeTranslations(existing: string | null, newData: Record<string, any>): string {
    let current: Record<string, any> = {}
    try { if (existing) current = JSON.parse(existing) } catch { /* */ }
    return JSON.stringify({ ...current, ...newData })
}

/** Build a structured translation prompt for a set of text fields across all missing languages */
function buildPrompt(fields: Record<string, string>, missingLangs: string[], extraInstruction = '') {
    const langList = missingLangs.map(l => `${l} (${LANG_NAMES[l]})`).join(', ')
    const fieldList = Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n')
    const schemaPerLang = Object.fromEntries(missingLangs.map(l => [l, Object.fromEntries(Object.keys(fields).map(k => [k, '...']))]))

    return `Translate the following English text into these languages: ${langList}.
Return ONLY valid JSON with this exact structure, no extra keys:
${JSON.stringify(schemaPerLang, null, 2)}

English source:
${fieldList}
${extraInstruction}`
}

// ─── POST /api/admin/training/[id]/translate ──────────────────────────────────
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id: courseId } = await params

    const course = await (prisma as any).course.findUnique({
        where: { id: courseId },
        include: {
            modules: {
                include: {
                    lessons: true,
                    quiz: { include: { questions: true } },
                },
            },
        },
    })
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    const results = { course: 0, modules: 0, lessons: 0, quizzes: 0, questions: 0, skipped: 0, errors: [] as string[] }

    // ── 1. Course ──
    const courseMissing = getMissingLangs(course.translations)
    if (courseMissing.length > 0) {
        try {
            const prompt = buildPrompt({ title: course.title, description: course.description }, courseMissing)
            const raw = await callAI(prompt)
            const t = JSON.parse(raw)
            await (prisma as any).course.update({ where: { id: courseId }, data: { translations: mergeTranslations(course.translations, t) } })
            results.course++
        } catch (err) { results.errors.push(`Course: ${err}`) }
    } else { results.skipped++ }

    // ── 2. Modules & Lessons ──
    for (const mod of course.modules) {
        const modMissing = getMissingLangs(mod.translations)
        if (modMissing.length > 0) {
            try {
                const prompt = buildPrompt({ title: mod.title, description: mod.description || '' }, modMissing)
                const raw = await callAI(prompt)
                const t = JSON.parse(raw)
                await (prisma as any).courseModule.update({ where: { id: mod.id }, data: { translations: mergeTranslations(mod.translations, t) } })
                results.modules++
            } catch (err) { results.errors.push(`Module "${mod.title}": ${err}`) }
        } else { results.skipped++ }

        for (const lesson of mod.lessons) {
            const lessonMissing = getMissingLangs(lesson.translations)
            if (lessonMissing.length > 0) {
                try {
                    const prompt = buildPrompt({ title: lesson.title, description: lesson.description || '' }, lessonMissing)
                    const raw = await callAI(prompt)
                    const t = JSON.parse(raw)
                    await (prisma as any).lesson.update({ where: { id: lesson.id }, data: { translations: mergeTranslations(lesson.translations, t) } })
                    results.lessons++
                } catch (err) { results.errors.push(`Lesson "${lesson.title}": ${err}`) }
            } else { results.skipped++ }
        }

        // ── 3. Quiz ──
        if (mod.quiz) {
            const quizMissing = getMissingLangs(mod.quiz.translations)
            if (quizMissing.length > 0) {
                try {
                    const prompt = buildPrompt({ title: mod.quiz.title }, quizMissing)
                    const raw = await callAI(prompt)
                    const t = JSON.parse(raw)
                    await (prisma as any).quiz.update({ where: { id: mod.quiz.id }, data: { translations: mergeTranslations(mod.quiz.translations, t) } })
                    results.quizzes++
                } catch (err) { results.errors.push(`Quiz "${mod.quiz.title}": ${err}`) }
            } else { results.skipped++ }

            // ── 4. Quiz questions ──
            for (const q of mod.quiz.questions || []) {
                const qMissing = getMissingLangs(q.translations)
                if (qMissing.length > 0) {
                    try {
                        let options: { id: string; text: string }[] = []
                        try { options = JSON.parse(q.options) } catch { /* */ }
                        const isTrueFalse = q.questionType === 'truefalse'

                        const fields: Record<string, string> = { questionText: q.questionText }
                        if (isTrueFalse) {
                            fields['option_true'] = 'True'
                            fields['option_false'] = 'False'
                        } else {
                            options.forEach(o => { fields[`option_${o.id}`] = o.text })
                        }

                        const prompt = buildPrompt(fields, qMissing,
                            isTrueFalse ? '\nNote: For option_true/option_false use the natural word for True/False in each language.' : '')
                        const raw = await callAI(prompt)
                        const t = JSON.parse(raw)
                        await (prisma as any).quizQuestion.update({ where: { id: q.id }, data: { translations: mergeTranslations(q.translations, t) } })
                        results.questions++
                    } catch (err) { results.errors.push(`Question "${q.questionText.slice(0, 40)}": ${err}`) }
                } else { results.skipped++ }
            }
        }
    }

    const total = results.course + results.modules + results.lessons + results.quizzes + results.questions
    return NextResponse.json({
        success: true,
        message: `Updated ${total} items across all ${ALL_LANGS.length} languages (ar, de, es, fr, hi, ja, ko, pt, ru, zh). Skipped ${results.skipped} (already complete). ${results.errors.length > 0 ? `${results.errors.length} error(s).` : ''}`,
        results,
    })
}
