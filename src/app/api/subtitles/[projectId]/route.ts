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

    const subtitle = await (prisma as any).filmSubtitle.findFirst({
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

    return NextResponse.json({
        segments,
        language: lang,
        originalLanguage: subtitle.language,
        available: [...new Set(available)],
        status: subtitle.status,
    })
}
