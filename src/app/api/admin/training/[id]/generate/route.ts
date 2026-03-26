import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

/* eslint-disable @typescript-eslint/no-explicit-any */

async function isAdmin() {
    try { await requireAdmin(); return true } catch { return false }
}

// Fetch an API key for the training agent with rotation
async function getTrainingKey() {
    const settings = await prisma.siteSettings.findFirst()
    // Try training-scoped keys first
    let keys = await prisma.apiKey.findMany({
        where: { isActive: true, assignedAgent: { in: ['training', 'all'] } },
        orderBy: [{ lastUsed: 'asc' }, { usageCount: 'asc' }],
    })
    // Fallback: any active key
    if (keys.length === 0) {
        keys = await prisma.apiKey.findMany({
            where: { isActive: true },
            orderBy: [{ lastUsed: 'asc' }, { usageCount: 'asc' }],
        })
    }
    // Last resort: settings key
    if (keys.length === 0 && settings?.geminiApiKey) {
        keys = [{ id: 'settings', key: settings.geminiApiKey, label: 'Settings Key', provider: 'gemini' } as any]
    }
    console.log(`[Training AI] Found ${keys.length} key(s):`, keys.map(k => `${k.label} (${k.assignedAgent}, used=${k.usageCount}, lastUsed=${k.lastUsed})`))
    return { keys, model: settings?.aiModel || 'gemini-2.5-flash' }
}

// Call AI provider with key rotation
async function callAI(prompt: string): Promise<string> {
    const { keys, model } = await getTrainingKey()
    if (keys.length === 0) throw new Error('No API keys configured. Go to Admin > Settings > API Keys.')

    const errors: string[] = []
    for (const keyInfo of keys) {
        try {
            let responseText = ''
            const provider = keyInfo.provider || 'gemini'

            if (provider === 'gemini') {
                const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyInfo.key}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
                        }),
                    }
                )
                const resText = await res.text()
                if (!res.ok) { const msg = `Gemini "${keyInfo.label}" error (${res.status}) model=${model}: ${resText.slice(0, 200)}`; console.error(msg); errors.push(msg); trackError(keyInfo, msg); continue }
                const data = JSON.parse(resText)
                responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
            } else if (provider === 'groq') {
                const groqModel = model.startsWith('gemini') ? 'llama-3.3-70b-versatile' : model
                const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${keyInfo.key}` },
                    body: JSON.stringify({
                        model: groqModel,
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.7,
                        response_format: { type: 'json_object' },
                    }),
                })
                if (!res.ok) { const msg = `Groq "${keyInfo.label}" error (${res.status})`; errors.push(msg); trackError(keyInfo, msg); continue }
                const data = await res.json()
                responseText = data.choices?.[0]?.message?.content || ''
            } else if (provider === 'openai') {
                const openaiModel = model.startsWith('gemini') || model.startsWith('llama') ? 'gpt-4o-mini' : model
                const res = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${keyInfo.key}` },
                    body: JSON.stringify({
                        model: openaiModel,
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.7,
                        response_format: { type: 'json_object' },
                    }),
                })
                if (!res.ok) { const msg = `OpenAI "${keyInfo.label}" error (${res.status})`; errors.push(msg); trackError(keyInfo, msg); continue }
                const data = await res.json()
                responseText = data.choices?.[0]?.message?.content || ''
            }

            if (!responseText) { errors.push(`${provider} "${keyInfo.label}": empty response`); continue }

            // Track success
            if (keyInfo.id !== 'settings') {
                await prisma.apiKey.update({
                    where: { id: keyInfo.id },
                    data: { usageCount: { increment: 1 }, lastUsed: new Date(), lastError: null },
                }).catch(() => {})
            }

            return responseText
        } catch (err) {
            const msg = `${keyInfo.provider || 'gemini'} "${keyInfo.label}": ${err instanceof Error ? err.message : String(err)}`
            errors.push(msg)
            trackError(keyInfo, msg)
        }
    }
    console.error('All AI keys failed:', errors)
    throw new Error(`All ${keys.length} API keys failed. ${errors.join(' | ')}`)
}

async function trackError(keyInfo: any, error: string) {
    if (keyInfo.id !== 'settings') {
        await prisma.apiKey.update({
            where: { id: keyInfo.id },
            data: { lastError: error.slice(0, 200), lastUsed: new Date() },
        }).catch(() => {})
    }
}

// POST — generate lesson content or quiz questions
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: courseId } = await params
    const body = await req.json()
    const { type, moduleTitle, moduleDescription, lessonTitle, lessonDescription, existingLessons, questionCount, sourceContent } = body

    if (!type) return NextResponse.json({ error: 'type required (full_course | lesson_content | quiz | review_guidance)' }, { status: 400 })

    // Get course context
    const course = await (prisma as any).course.findUnique({
        where: { id: courseId },
        select: { title: true, description: true, category: true, level: true },
    })

    try {
        if (type === 'full_course') {
            // ── Full course generation from source content ──
            if (!sourceContent || sourceContent.trim().length < 50) {
                return NextResponse.json({ error: 'Source content must be at least 50 characters' }, { status: 400 })
            }

            const prompt = `You are an expert curriculum designer and training content creator. Analyze the following source material and create a structured online training course.

COURSE TITLE: "${course?.title || body.courseTitle || 'Training Course'}"
COURSE CATEGORY: ${course?.category || body.courseCategory || 'general'}
COURSE LEVEL: ${course?.level || body.courseLevel || 'beginner'}

SOURCE MATERIAL:
---
${sourceContent.slice(0, 15000)}
---

RULES:
- Create a MAXIMUM of 4 modules (fewer if the content doesn't warrant more)
- Each module has a MAXIMUM of 4 lessons (fewer if appropriate)
- Each lesson must have substantial content (400-800 words in markdown)
- Create a FINAL QUIZ with 10 questions covering ALL modules
- Mix question types: multiple_choice and truefalse
- Lessons should flow logically and build upon each other
- Each module should cover a distinct topic area from the source material
- Include Spanish (es) and Chinese (zh) translations for ALL quiz text content

Return ONLY valid JSON in this exact structure:
{
  "courseDescription": "A compelling 2-3 sentence course description",
  "modules": [
    {
      "title": "Module Title",
      "description": "2-3 sentence module description",
      "lessons": [
        {
          "title": "Lesson Title",
          "description": "1-2 sentence lesson summary",
          "content": "Full lesson content in markdown format with headings (##), bullet points, examples, and key takeaways. Must be 400-800 words.",
          "contentType": "document",
          "duration": 15
        }
      ]
    }
  ],
  "finalQuiz": {
    "title": "Final Assessment",
    "passMark": 70,
    "translations": "{\\"es\\":{\\"title\\":\\"Spanish quiz title\\"},\\"zh\\":{\\"title\\":\\"Chinese quiz title\\"}}",
    "questions": [
      {
        "questionText": "Question text",
        "questionType": "multiple_choice",
        "options": [
          {"id": "a", "text": "Option A"},
          {"id": "b", "text": "Option B"},
          {"id": "c", "text": "Option C"},
          {"id": "d", "text": "Option D"}
        ],
        "correctAnswer": "a",
        "explanation": "Why this answer is correct",
        "translations": "{\\"es\\":{\\"questionText\\":\\"Spanish question\\",\\"option_a\\":\\"Spanish A\\",\\"option_b\\":\\"Spanish B\\",\\"option_c\\":\\"Spanish C\\",\\"option_d\\":\\"Spanish D\\"},\\"zh\\":{\\"questionText\\":\\"Chinese question\\",\\"option_a\\":\\"Chinese A\\",\\"option_b\\":\\"Chinese B\\",\\"option_c\\":\\"Chinese C\\",\\"option_d\\":\\"Chinese D\\"}}"
      }
    ]
  }
}`

            const text = await callAI(prompt)
            const result = JSON.parse(text)

            // Save source content + AI description to course (best-effort, don't block generation)
            await (prisma as any).course.update({
                where: { id: courseId },
                data: {
                    sourceContent: sourceContent,
                    ...(result.courseDescription ? { description: result.courseDescription } : {}),
                },
            }).catch(() => { /* course may not exist yet — generation still succeeds */ })

            return NextResponse.json({ success: true, type: 'full_course', data: result })

        } else if (type === 'lesson_content') {
            const prompt = `You are a training content creator. Generate a comprehensive lesson for an online training course.

COURSE: "${course?.title || 'Training Course'}"
COURSE DESCRIPTION: ${course?.description || 'N/A'}
MODULE: "${moduleTitle || 'Module'}"
MODULE DESCRIPTION: ${moduleDescription || 'N/A'}
LESSON TITLE: "${lessonTitle || 'Lesson'}"
LESSON DESCRIPTION: ${lessonDescription || 'N/A'}

Generate detailed lesson content in this JSON format:
{
  "title": "Improved title if needed",
  "description": "A 2-3 sentence lesson summary",
  "content": "Full lesson content in markdown format, including headings, bullet points, examples, and key takeaways. Make it comprehensive (800-1500 words).",
  "keyPoints": ["list", "of", "3-5", "key", "takeaways"],
  "estimatedDuration": number_in_minutes,
  "suggestedResources": [{"title": "Resource Name", "url": "optional_url", "type": "article|video|book"}]
}`

            const text = await callAI(prompt)
            const result = JSON.parse(text)
            return NextResponse.json({ success: true, type: 'lesson_content', data: result })

        } else if (type === 'quiz') {
            const count = questionCount || 5
            const lessonsContext = existingLessons?.map((l: string) => `- ${l}`).join('\n') || 'No lessons specified'

            const prompt = `You are a quiz creator for an online training platform. Generate quiz questions that test understanding of the module content.

COURSE: "${course?.title || 'Training Course'}"
MODULE: "${moduleTitle || 'Module'}"
MODULE DESCRIPTION: ${moduleDescription || 'N/A'}
LESSONS IN THIS MODULE:
${lessonsContext}

Generate exactly ${count} quiz questions. Mix question types (multiple_choice, truefalse).
IMPORTANT: Include translations for Spanish (es) and Chinese (zh) for ALL text content.

Respond in this exact JSON format:
{
  "title": "Quiz: ${moduleTitle || 'Module Quiz'}",
  "passMark": 70,
  "translations": "{\\"es\\":{\\"title\\":\\"Spanish quiz title\\"},\\"zh\\":{\\"title\\":\\"Chinese quiz title\\"}}",
  "questions": [
    {
      "questionText": "Clear question text in English",
      "questionType": "multiple_choice",
      "options": [
        {"id": "a", "text": "Option A in English"},
        {"id": "b", "text": "Option B in English"},
        {"id": "c", "text": "Option C in English"},
        {"id": "d", "text": "Option D in English"}
      ],
      "correctAnswer": "a",
      "explanation": "Brief explanation of why this is correct",
      "translations": "{\\"es\\":{\\"questionText\\":\\"Spanish question\\",\\"option_a\\":\\"Spanish A\\",\\"option_b\\":\\"Spanish B\\",\\"option_c\\":\\"Spanish C\\",\\"option_d\\":\\"Spanish D\\"},\\"zh\\":{\\"questionText\\":\\"Chinese question\\",\\"option_a\\":\\"Chinese A\\",\\"option_b\\":\\"Chinese B\\",\\"option_c\\":\\"Chinese C\\",\\"option_d\\":\\"Chinese D\\"}}"
    },
    {
      "questionText": "Is this statement true or false?",
      "questionType": "truefalse",
      "options": [],
      "correctAnswer": "true",
      "explanation": "Brief explanation",
      "translations": "{\\"es\\":{\\"questionText\\":\\"Spanish question\\",\\"option_true\\":\\"Verdadero\\",\\"option_false\\":\\"Falso\\"},\\"zh\\":{\\"questionText\\":\\"Chinese question\\",\\"option_true\\":\\"正确\\",\\"option_false\\":\\"错误\\"}}"
    }
  ]
}

Make questions that genuinely test understanding, not trivial recall. Include a mix of conceptual and applied questions.`

            const text = await callAI(prompt)
            const result = JSON.parse(text)
            return NextResponse.json({ success: true, type: 'quiz', data: result })

        } else if (type === 'review_guidance') {
            const prompt = `You are a learning specialist. Generate review guidance for a student who failed a module quiz and needs to review before retaking.

COURSE: "${course?.title || 'Training Course'}"
MODULE: "${moduleTitle || 'Module'}"
MODULE DESCRIPTION: ${moduleDescription || 'N/A'}
LESSONS:
${existingLessons?.map((l: string) => `- ${l}`).join('\n') || 'N/A'}

Generate focused review guidance in this JSON format:
{
  "reviewPlan": "A structured review plan (3-5 steps) explaining how to review the material effectively",
  "focusAreas": ["list", "of", "key", "areas", "to", "focus on"],
  "studyTips": ["3-4 study tips relevant to this module's content"],
  "estimatedReviewTime": number_in_minutes
}`

            const text = await callAI(prompt)
            const result = JSON.parse(text)
            return NextResponse.json({ success: true, type: 'review_guidance', data: result })

        } else {
            return NextResponse.json({ error: 'Invalid type. Use: lesson_content, quiz, or review_guidance' }, { status: 400 })
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'AI generation failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
