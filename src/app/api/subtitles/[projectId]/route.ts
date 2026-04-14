import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/subtitles/[projectId]?lang=es&episodeId=xxx
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const { projectId } = await params
    const { searchParams } = new URL(req.url)
    const lang = searchParams.get('lang') || 'en'
    const episodeId = searchParams.get('episodeId') || null
    const format = searchParams.get('format') || 'json'

    const subtitle = await prisma.filmSubtitle.findFirst({
        where: {
            projectId,
            episodeId: episodeId || null,
        },
    })

    if (!subtitle) {
        return NextResponse.json({ segments: null, available: [] })
    }

    // Parse the stored data
    let segments: { start: number; end: number; text: string }[] = []
    const available: string[] = [subtitle.language] // original language is always available

    // Get original segments
    try {
        segments = JSON.parse(subtitle.segments)
    } catch {
        return NextResponse.json({ segments: null, available })
    }

    // Parse translations to find available languages
    let translations: Record<string, { start: number; end: number; text: string }[]> = {}
    if (subtitle.translations) {
        try {
            translations = JSON.parse(subtitle.translations)
            available.push(...Object.keys(translations))
        } catch { /* ignore */ }
    }

    // If requested language is a translation, return those segments
    if (lang !== subtitle.language && translations[lang]) {
        segments = translations[lang]
    }

    if (format === 'vtt') {
        return new NextResponse(toWebVTT(segments), {
            headers: {
                'Content-Type': 'text/vtt',
                'Access-Control-Allow-Origin': '*', // required for HTML5 <track> cross-origin
                'Cache-Control': 'public, max-age=3600', // subtitles are static after generation
            },
        })
    }

    return NextResponse.json({
        segments,
        language: lang,
        originalLanguage: subtitle.language,
        available: [...new Set(available)],
        status: subtitle.status,
        translateStatus: subtitle.translateStatus,
    }, {
        headers: {
            // Subtitles are static after generation — safe to cache for 60s
            // Short TTL allows re-fetching after re-generation without stale data
            'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        },
    })
}

// Converts segments to WebVTT format for HTML5 <track> element
function toWebVTT(segments: { start: number; end: number; text: string }[]): string {
    const pad = (n: number) => String(Math.floor(n)).padStart(2, '0')
    const formatTime = (s: number) => {
        const h = Math.floor(s / 3600)
        const m = Math.floor((s % 3600) / 60)
        const sec = Math.floor(s % 60)
        const ms = Math.round((s % 1) * 1000)
        return `${pad(h)}:${pad(m)}:${pad(sec)}.${String(ms).padStart(3, '0')}`
    }
    const cues = segments
        .filter(s => s.text?.trim())
        .map((s, i) => `${i + 1}\n${formatTime(s.start)} --> ${formatTime(s.end)} line:85% align:center\n${s.text.trim()}`)
        .join('\n\n')
    return `WEBVTT\n\n${cues}`
}
