import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

async function isAdmin() {
    const session = await getSession()
    return session?.role === 'admin' || session?.role === 'superadmin'
}

// POST — admin triggers AI analysis for a specific submission
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { submissionId } = await req.json()
    if (!submissionId) return NextResponse.json({ error: 'submissionId required' }, { status: 400 })

    // Get the submission + call details
    const submission = await prisma.scriptSubmission.findUnique({
        where: { id: submissionId },
        include: { scriptCall: true },
    })

    if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })

    // Get settings for model preference
    const settings = await prisma.siteSettings.findFirst()

    // Get API keys scoped to "scripts" agent with rotation
    let keys = await prisma.apiKey.findMany({
        where: {
            isActive: true,
            provider: 'gemini',
            assignedAgent: { in: ['scripts', 'all'] },
        },
        orderBy: { lastUsed: 'asc' },
    })
    // Fallback: any active gemini key
    if (keys.length === 0) {
        keys = await prisma.apiKey.findMany({
            where: { isActive: true, provider: 'gemini' },
            orderBy: { lastUsed: 'asc' },
        })
    }
    // Last resort: settings key
    if (keys.length === 0 && settings?.geminiApiKey) {
        keys = [{ id: 'settings', key: settings.geminiApiKey, label: 'Settings Key' } as typeof keys[0]]
    }

    if (keys.length === 0) {
        return NextResponse.json({ error: 'No API keys configured. Go to Admin > Settings > API Keys.' }, { status: 400 })
    }

    // Mark as analyzing
    await prisma.scriptSubmission.update({
        where: { id: submissionId },
        data: { status: 'analyzing' },
    })

    try {
        const prompt = buildAnalysisPrompt(submission, submission.scriptCall)
        const aiModel = settings?.aiModel || 'gemini-2.5-flash'
        let lastError = ''

        for (const keyInfo of keys) {
            try {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${keyInfo.key}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: {
                                responseMimeType: 'application/json',
                                temperature: 0.3,
                            },
                        }),
                    }
                )

                if (!response.ok) {
                    const err = await response.text()
                    lastError = `Gemini API error (${response.status}): ${err.slice(0, 200)}`
                    if (keyInfo.id !== 'settings') {
                        await prisma.apiKey.update({
                            where: { id: keyInfo.id },
                            data: { lastError: lastError.slice(0, 200), lastUsed: new Date() },
                        }).catch(() => {})
                    }
                    continue
                }

                // Record success
                if (keyInfo.id !== 'settings') {
                    await prisma.apiKey.update({
                        where: { id: keyInfo.id },
                        data: { usageCount: { increment: 1 }, lastUsed: new Date(), lastError: null },
                    }).catch(() => {})
                }

                const data = await response.json()
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text
                if (!text) {
                    lastError = 'No response from AI'
                    continue
                }

                const analysis = JSON.parse(text)

                // Calculate overall score (weighted average)
                const overallScore = (
                    (analysis.originalityScore || 0) * 0.20 +
                    (analysis.structureScore || 0) * 0.20 +
                    (analysis.dialogueScore || 0) * 0.15 +
                    (analysis.visualPotentialScore || 0) * 0.15 +
                    (analysis.themeAlignmentScore || 0) * 0.15 +
                    (analysis.feasibilityScore || 0) * 0.15
                )

                // Upsert analysis
                await prisma.scriptAnalysis.upsert({
                    where: { submissionId },
                    create: {
                        submissionId,
                        originalityScore: analysis.originalityScore || 0,
                        structureScore: analysis.structureScore || 0,
                        dialogueScore: analysis.dialogueScore || 0,
                        visualPotentialScore: analysis.visualPotentialScore || 0,
                        themeAlignmentScore: analysis.themeAlignmentScore || 0,
                        feasibilityScore: analysis.feasibilityScore || 0,
                        overallScore: Math.round(overallScore * 10) / 10,
                        strengths: analysis.strengths || '',
                        concerns: analysis.concerns || '',
                        recommendation: analysis.recommendation || '',
                        rawReport: text,
                    },
                    update: {
                        originalityScore: analysis.originalityScore || 0,
                        structureScore: analysis.structureScore || 0,
                        dialogueScore: analysis.dialogueScore || 0,
                        visualPotentialScore: analysis.visualPotentialScore || 0,
                        themeAlignmentScore: analysis.themeAlignmentScore || 0,
                        feasibilityScore: analysis.feasibilityScore || 0,
                        overallScore: Math.round(overallScore * 10) / 10,
                        strengths: analysis.strengths || '',
                        concerns: analysis.concerns || '',
                        recommendation: analysis.recommendation || '',
                        rawReport: text,
                        analyzedAt: new Date(),
                    },
                })

                // Update submission status
                await prisma.scriptSubmission.update({
                    where: { id: submissionId },
                    data: { status: 'analyzed' },
                })

                return NextResponse.json({ success: true, overallScore: Math.round(overallScore * 10) / 10 })
            } catch (keyErr) {
                lastError = keyErr instanceof Error ? keyErr.message : String(keyErr)
                if (keyInfo.id !== 'settings') {
                    await prisma.apiKey.update({
                        where: { id: keyInfo.id },
                        data: { lastError: lastError.slice(0, 200), lastUsed: new Date() },
                    }).catch(() => {})
                }
                continue
            }
        }

        // All keys exhausted
        throw new Error(lastError || 'All API keys failed')
    } catch (error: unknown) {
        // Revert status on failure
        await prisma.scriptSubmission.update({
            where: { id: submissionId },
            data: { status: 'submitted' },
        })
        const message = process.env.NODE_ENV === 'development'
            ? (error instanceof Error ? error.message : 'Analysis failed')
            : 'Analysis failed'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

function buildAnalysisPrompt(
    submission: { title: string; logline: string; synopsis: string; scriptText: string | null; genre: string | null; estimatedDuration: string | null },
    call: { title: string; description: string; genre: string | null; toneKeywords: string | null; targetLength: string | null }
) {
    return `You are an expert script analyst for AIM Studio, an AI-powered filmmaking company. Analyze the following screenplay submission for a script call.

SCRIPT CALL BRIEF:
- Call: "${call.title}"
- Brief: ${call.description}
- Desired Genre: ${call.genre || 'Any'}
- Tone: ${call.toneKeywords || 'Not specified'}
- Target Length: ${call.targetLength || 'Not specified'}

SUBMISSION:
- Title: "${submission.title}"
- Logline: ${submission.logline}
- Genre: ${submission.genre || 'Not specified'}
- Estimated Duration: ${submission.estimatedDuration || 'Not specified'}
- Synopsis: ${submission.synopsis}
${submission.scriptText ? `\n- Full Script:\n${submission.scriptText.slice(0, 15000)}` : ''}

Score each category from 0 to 100:

1. originalityScore — How unique/fresh is the premise? Does it avoid clichés?
2. structureScore — Does it follow solid 3-act structure? Good pacing, character arcs?
3. dialogueScore — Natural dialogue? Distinct character voices?
4. visualPotentialScore — Is it visually filmable with AI tools? Strong visual storytelling?
5. themeAlignmentScore — How well does it match the call's genre, tone, and brief?
6. feasibilityScore — Can AIM Studio realistically produce this with AI filmmaking?

Also provide:
- strengths: 2-3 bullet points of what's great about this script (as a single string with newlines)
- concerns: 2-3 bullet points of weaknesses or risks (as a single string with newlines)
- recommendation: A short 2-3 sentence recommendation (SELECT, CONSIDER, or PASS) with reasoning

Respond in this exact JSON format:
{
  "originalityScore": number,
  "structureScore": number,
  "dialogueScore": number,
  "visualPotentialScore": number,
  "themeAlignmentScore": number,
  "feasibilityScore": number,
  "strengths": "string",
  "concerns": "string",
  "recommendation": "string"
}`
}
