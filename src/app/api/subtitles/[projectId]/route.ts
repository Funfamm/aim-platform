import { NextRequest, NextResponse } from 'next/server'
import { segmentsToVtt, getVttUrl } from '@/lib/vtt-storage'
import { findSubtitle } from '@/lib/subtitle-repo'

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

    // ── Repository lookup — no direct Prisma dependency (DIP) ─────────────────
    const subtitle = await findSubtitle(projectId, episodeId)

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
        // Serve from R2 cache if available (version-hashed key → CDN-safe)
        const vttPaths = subtitle.vttPaths as Record<string, string> | null
        const cachedUrl = getVttUrl(lang, vttPaths)
        if (cachedUrl) {
            return NextResponse.redirect(cachedUrl, {
                headers: {
                    'Cache-Control': 'public, max-age=3600',
                    'Access-Control-Allow-Origin': '*',
                },
            })
        }

        // Fallback: runtime VTT generation — reuses segmentsToVtt from vtt-storage (DRY/SRP)
        return new NextResponse(segmentsToVtt(segments), {
            headers: {
                'Content-Type': 'text/vtt',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
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
            'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        },
    })
}
