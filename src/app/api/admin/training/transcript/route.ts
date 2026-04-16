import { NextResponse, NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { SUBTITLE_TARGET_LANGS } from '@/lib/subtitle-languages'

// GET — Fetch transcript for a lesson
export async function GET(req: NextRequest) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const lessonId = req.nextUrl.searchParams.get('lessonId')
    if (!lessonId) return NextResponse.json({ error: 'lessonId required' }, { status: 400 })

    const transcript = await prisma.transcript.findUnique({ where: { lessonId } })
    if (!transcript) return NextResponse.json({ error: 'No transcript found' }, { status: 404 })

    return NextResponse.json(transcript)
}

// POST — Create/reset transcript record (transcription now happens client-side)
export async function POST(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const { lessonId } = await req.json()
        if (!lessonId) return NextResponse.json({ error: 'lessonId required' }, { status: 400 })

        const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } })
        if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
        if (lesson.contentType !== 'video') return NextResponse.json({ error: 'Lesson is not a video' }, { status: 400 })

        // Check for existing transcript
        const existing = await prisma.transcript.findUnique({ where: { lessonId } })
        if (existing && existing.status === 'completed') {
            return NextResponse.json({ message: 'Transcript already exists', transcript: existing })
        }

        // Create or reset transcript record — actual transcription happens in the browser
        const transcript = existing
            ? await prisma.transcript.update({ where: { id: existing.id }, data: { status: 'processing' } })
            : await prisma.transcript.create({ data: { lessonId, segments: '[]', status: 'processing' } })

        return NextResponse.json({
            message: 'Transcript record created. Use client-side transcription to generate content.',
            transcript: { id: transcript.id, lessonId, status: 'processing' },
        })
    } catch (err) {
        return NextResponse.json({ error: 'Failed', details: String(err) }, { status: 500 })
    }
}

// PUT — Save/update transcript + auto-translate for subtitles
export async function PUT(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const { lessonId, segments, translations } = await req.json()
        if (!lessonId) return NextResponse.json({ error: 'lessonId required' }, { status: 400 })

        const segArray = typeof segments === 'string' ? JSON.parse(segments) : (segments || [])
        const segJson = JSON.stringify(segArray)

        const existing = await prisma.transcript.findUnique({ where: { lessonId } })

        // Save immediately with English segments
        const data: Record<string, unknown> = {
            segments: segJson,
            language: 'en',
            status: 'completed' as const,
        }
        if (translations) {
            data.translations = typeof translations === 'string' ? translations : JSON.stringify(translations)
        }

        const transcript = existing
            ? await prisma.transcript.update({ where: { id: existing.id }, data })
            : await prisma.transcript.create({ data: { lessonId, ...data } as { lessonId: string; segments: string; language: string; status: string; translations?: string } })

        // Auto-translate in background (non-blocking)
        if (!translations && segArray.length > 0) {
            translateTranscriptSegments(transcript.id, segArray).catch(err => {
                console.error('Transcript auto-translation failed:', err)
            })
        }

        return NextResponse.json(transcript)
    } catch (err) {
        return NextResponse.json({ error: 'Failed', details: String(err) }, { status: 500 })
    }
}

// Background translation of transcript segments
async function translateTranscriptSegments(
    transcriptId: string,
    segments: { start: number; end: number; text: string }[]
) {
    try {
        const { callGemini } = await import('@/lib/gemini')
        // Combine segment texts for batch translation
        const texts = segments.map(s => s.text)
        const numberedLines = texts.map((t, i) => `${i}: ${t}`).join('\n')

        const translations: Record<string, { start: number; end: number; text: string }[]> = {}

        // Translate to each locale (could batch, but safer to do per-locale)
        for (const locale of SUBTITLE_TARGET_LANGS) {
            try {
                const prompt = `Translate each numbered line to ${locale}. Keep the same numbering. Return ONLY the translated lines in format "N: translated text", nothing else.\n\n${numberedLines}`
                const geminiResult = await callGemini(prompt, 'training')
                if (!geminiResult || 'error' in geminiResult) continue
                const result = geminiResult.text

                // Parse numbered response
                const lines = result.split('\n').filter((l: string) => l.trim())
                const translatedTexts: string[] = new Array(texts.length).fill('')
                for (const line of lines) {
                    const match = line.match(/^(\d+):\s*(.+)/)
                    if (match) {
                        const idx = parseInt(match[1])
                        if (idx >= 0 && idx < texts.length) {
                            translatedTexts[idx] = match[2].trim()
                        }
                    }
                }

                // Build translated segments with same timestamps
                translations[locale] = segments.map((seg, i) => ({
                    start: seg.start,
                    end: seg.end,
                    text: translatedTexts[i] || seg.text,
                }))
            } catch {
                // Skip locale on error
            }
        }

        // Save translations
        if (Object.keys(translations).length > 0) {
            await prisma.transcript.update({
                where: { id: transcriptId },
                data: { translations: JSON.stringify(translations) },
            })
        }
    } catch (err) {
        console.error('translateTranscriptSegments error:', err)
    }
}
