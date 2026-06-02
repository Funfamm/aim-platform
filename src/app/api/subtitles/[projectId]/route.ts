import { NextRequest, NextResponse } from 'next/server'
import { segmentsToVtt, getVttUrl } from '@/lib/vtt-storage'
import { findSubtitle } from '@/lib/subtitle-repo'
import { getUserSession } from '@/lib/auth'
import { hasAdminRole } from '@/lib/roles'
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
    const mediaType = searchParams.get('mediaType') || 'movie'
    const format = searchParams.get('format') || 'json'

    // ── Both gates in parallel — no serial waterfall ───────────────────────────
    const [subtitle, project] = await Promise.all([
        findSubtitle(projectId, episodeId, mediaType),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prisma as any).project.findUnique({
            where: { id: projectId },
            select: { subtitlesPublic: true },
        }),
    ])

    if (!subtitle) {
        return NextResponse.json({ segments: null, available: [] })
    }

    // ── Dual-gate visibility check ─────────────────────────────────────────────
    // Project.subtitlesPublic: the master on/off switch saved via the project form.
    // FilmSubtitle.subtitlesPublic: the per-track toggle from the subtitle panel.
    // BOTH must be true for public access. Admins bypass for preview purposes.
    const projectGate = (project as { subtitlesPublic: boolean } | null)?.subtitlesPublic ?? false
    const trackGate = subtitle.subtitlesPublic

    if (!projectGate || !trackGate) {
        // Admins can always preview even when hidden from public
        const session = await getUserSession()
        if (!session?.userId || !hasAdminRole(session.role)) {
            return NextResponse.json({ segments: null, available: [] })
        }
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

    // Step 5 instrumentation
    const originalLang = (subtitle as Record<string, unknown>).originalLanguage as string | null
    console.info(
        `[subtitles/GET] projectId=${projectId} requestedLang=${lang}` +
        ` subtitleLanguage=${subtitle.language}` +
        ` originalLanguage=${originalLang ?? 'null'}` +
        ` available=[${[...new Set(available)].join(',')}]` +
        ` englishTrackVisibleInUI=${available.includes('en')}` +
        ` englishTrackSelectable=${available.includes('en')}`
    )


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
        // Visibility is admin-controlled — no public CDN cache so enable/disable
        // takes effect immediately for all users.
        status: subtitle.status,
        translateStatus: subtitle.translateStatus,
        // T4-E: Desktop placement metadata for the public player
        placement: {
            verticalAnchor:   (subtitle as Record<string, unknown>).verticalAnchor   ?? 'bottom',
            horizontalAlign:  (subtitle as Record<string, unknown>).horizontalAlign  ?? 'center',
            offsetYPercent:   (subtitle as Record<string, unknown>).offsetYPercent   ?? 0,
            offsetXPercent:   (subtitle as Record<string, unknown>).offsetXPercent   ?? 0,
            safeAreaMarginPx: (subtitle as Record<string, unknown>).safeAreaMarginPx ?? 12,
            backgroundStyle:  (subtitle as Record<string, unknown>).backgroundStyle  ?? 'shadow',
            fontScale:        (subtitle as Record<string, unknown>).fontScale        ?? 1.0,
            cueOverrides: (() => {
                try {
                    const raw = (subtitle as Record<string, unknown>).cueOverrides
                    if (!raw || raw === '{}') return {}
                    return typeof raw === 'string' ? JSON.parse(raw) : raw
                } catch { return {} }
            })(),
        },
        // T4-M: Mobile placement — used by the player when useSeparateMobilePlacement is true.
        // Defaults are safe for old records that predate this field.
        mobilePlacement: {
            useSeparateMobilePlacement: (subtitle as Record<string, unknown>).useSeparateMobilePlacement ?? false,
            verticalAnchor:   (subtitle as Record<string, unknown>).mobileVerticalAnchor   ?? 'bottom',
            horizontalAlign:  (subtitle as Record<string, unknown>).mobileHorizontalAlign  ?? 'center',
            offsetYPercent:   (subtitle as Record<string, unknown>).mobileOffsetYPercent   ?? 0,
            offsetXPercent:   (subtitle as Record<string, unknown>).mobileOffsetXPercent   ?? 0,  // Fix #1: was missing
            safeAreaMarginPx: (subtitle as Record<string, unknown>).mobileSafeAreaMarginPx ?? 20,
            fontScale:        (subtitle as Record<string, unknown>).mobileFontScale        ?? 0.9,
        },
        // T4-L: Landscape-specific placement
        landscapePlacement: {
            verticalAnchor:   (subtitle as Record<string, unknown>).landscapeVerticalAnchor   ?? 'bottom',
            horizontalAlign:  (subtitle as Record<string, unknown>).landscapeHorizontalAlign  ?? 'center',
            offsetYPercent:   (subtitle as Record<string, unknown>).landscapeOffsetYPercent   ?? 0,
            offsetXPercent:   (subtitle as Record<string, unknown>).landscapeOffsetXPercent   ?? 0,
            safeAreaMarginPx: (subtitle as Record<string, unknown>).landscapeSafeAreaMarginPx ?? 20,
            fontScale:        (subtitle as Record<string, unknown>).landscapeFontScale         ?? 0.9,
        },
    }, {
        headers: {
            // private: browser may cache for this user only, no CDN.
            // Admin can enable/disable at any time; each page load must re-validate.
            'Cache-Control': 'private, no-cache',
        },
    })
}
