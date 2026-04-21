import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { hasAdminRole } from '@/lib/roles'
import { findSubtitle, updateSubtitleById, upsertSubtitle } from '@/lib/subtitle-repo'
import { upsertSubtitleRecord } from '@/lib/subtitle-status-service'
import { prisma } from '@/lib/db'

// ── Placement fields shape ─────────────────────────────────────────────────
type PlacementPatch = {
    verticalAnchor?: string
    horizontalAlign?: string
    offsetYPercent?: number
    offsetXPercent?: number
    safeAreaMarginPx?: number
    backgroundStyle?: string
    fontScale?: number
    cueOverrides?: Record<string, unknown>
}

type MobilePlacementPatch = {
    verticalAnchor?: string
    horizontalAlign?: string
    offsetYPercent?: number
    offsetXPercent?: number
    safeAreaMarginPx?: number
    fontScale?: number
}

// ── Auth guard helper ──────────────────────────────────────────────
async function requireAdmin() {
    const session = await getUserSession()
    if (!session?.userId) return { error: 'Unauthorized', status: 401 }
    if (!hasAdminRole(session.role)) return { error: 'Forbidden', status: 403 }
    return null
}

// GET — fetch subtitles for a project/episode (admin view with full data)
export async function GET(req: NextRequest) {
    const denied = await requireAdmin()
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const episodeId = searchParams.get('episodeId') || null

    if (!projectId) {
        return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    const subtitle = await findSubtitle(projectId, episodeId)
    return NextResponse.json({ subtitle })
}

// POST — save/update subtitles (called after browser transcription or SRT upload completes)
export async function POST(req: NextRequest) {
    const denied = await requireAdmin()
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

    try {
        const body = await req.json()
        const { projectId, episodeId, language, segments, translations, status, transcribedWith, qcIssues } = body

        if (!projectId || !segments) {
            return NextResponse.json({ error: 'projectId and segments required' }, { status: 400 })
        }

        const segmentsStr = typeof segments === 'string' ? segments : JSON.stringify(segments)
        const translationsStr = translations
            ? (typeof translations === 'string' ? translations : JSON.stringify(translations))
            : null
        const qcIssuesStr = qcIssues
            ? (typeof qcIssues === 'string' ? qcIssues : JSON.stringify(qcIssues))
            : null

        const subtitle = await upsertSubtitleRecord({
            projectId,
            episodeId: episodeId || null,
            language,
            segments: segmentsStr,
            translations: translationsStr,
            status,
            transcribedWith,
            qcIssues: qcIssuesStr,
        })

        return NextResponse.json({ subtitle })
    } catch (error) {
        console.error('Subtitle save error:', error)
        return NextResponse.json({ error: 'Failed to save subtitles' }, { status: 500 })
    }
}

/**
 * PATCH — Admin edits subtitle segments (post-generation, pre-translation).
 * Saves the corrected segments. If the track was previously approved,
 * the approval status resets to 'pending' (edits invalidate the approval).
 */
export async function PATCH(req: NextRequest) {
    const session = await getUserSession()
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasAdminRole(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    try {
        const body = await req.json()
        const { 
            projectId, episodeId, segments, changeSource, 
            placement, useSeparateMobilePlacement, 
            mobilePlacement, landscapePlacement 
        } = body as {
            projectId: string
            episodeId?: string | null
            segments: Array<{ start: number; end: number; text: string }> | string
            changeSource?: string
            placement?: PlacementPatch
            useSeparateMobilePlacement?: boolean
            mobilePlacement?: MobilePlacementPatch
            landscapePlacement?: MobilePlacementPatch
        }

        if (!projectId || !segments) {
            return NextResponse.json({ error: 'projectId and segments required' }, { status: 400 })
        }

        const existing = await findSubtitle(projectId, episodeId || null)
        if (!existing) {
            return NextResponse.json({ error: 'No subtitle record found' }, { status: 404 })
        }

        const segmentsArr = typeof segments === 'string' ? JSON.parse(segments) : segments
        const segmentsStr = JSON.stringify(segmentsArr)

        // If previously approved, edits reset the approval
        const newStatus = existing.status === 'approved_source' ? 'pending' : (existing.status ?? 'pending')

        // Build placement update
        const data: any = {
            segments: segmentsStr,
            status: newStatus,
            translateStatus: 'pending',
        }

        if (useSeparateMobilePlacement !== undefined) {
            data.useSeparateMobilePlacement = useSeparateMobilePlacement
        }

        // Standard / Desktop placement
        if (placement) {
            if (placement.verticalAnchor !== undefined) data.verticalAnchor = placement.verticalAnchor
            if (placement.horizontalAlign !== undefined) data.horizontalAlign = placement.horizontalAlign
            if (placement.offsetYPercent !== undefined) data.offsetYPercent = placement.offsetYPercent
            if (placement.offsetXPercent !== undefined) data.offsetXPercent = placement.offsetXPercent
            if (placement.safeAreaMarginPx !== undefined) data.safeAreaMarginPx = placement.safeAreaMarginPx
            if (placement.backgroundStyle !== undefined) data.backgroundStyle = placement.backgroundStyle
            if (placement.fontScale !== undefined) data.fontScale = placement.fontScale
            if (placement.cueOverrides !== undefined) data.cueOverrides = JSON.stringify(placement.cueOverrides)
        }

        // Mobile (Portrait) placement
        if (mobilePlacement) {
            if (mobilePlacement.verticalAnchor !== undefined) data.mobileVerticalAnchor = mobilePlacement.verticalAnchor
            if (mobilePlacement.horizontalAlign !== undefined) data.mobileHorizontalAlign = mobilePlacement.horizontalAlign
            if (mobilePlacement.offsetYPercent !== undefined) data.mobileOffsetYPercent = mobilePlacement.offsetYPercent
            if (mobilePlacement.offsetXPercent !== undefined) data.mobileOffsetXPercent = mobilePlacement.offsetXPercent
            if (mobilePlacement.safeAreaMarginPx !== undefined) data.mobileSafeAreaMarginPx = mobilePlacement.safeAreaMarginPx
            if (mobilePlacement.fontScale !== undefined) data.mobileFontScale = mobilePlacement.fontScale
        }

        // Landscape placement
        if (landscapePlacement) {
            if (landscapePlacement.verticalAnchor !== undefined) data.landscapeVerticalAnchor = landscapePlacement.verticalAnchor
            if (landscapePlacement.horizontalAlign !== undefined) data.landscapeHorizontalAlign = landscapePlacement.horizontalAlign
            if (landscapePlacement.offsetYPercent !== undefined) data.landscapeOffsetYPercent = landscapePlacement.offsetYPercent
            if (landscapePlacement.offsetXPercent !== undefined) data.landscapeOffsetXPercent = landscapePlacement.offsetXPercent
            if (landscapePlacement.safeAreaMarginPx !== undefined) data.landscapeSafeAreaMarginPx = landscapePlacement.safeAreaMarginPx
            if (landscapePlacement.fontScale !== undefined) data.landscapeFontScale = landscapePlacement.fontScale
        }

        await prisma.filmSubtitle.update({
            where: { id: existing.id },
            data,
        })

        // Save revision snapshot
        const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } })
        await prisma.subtitleRevision.create({
            data: {
                subtitleId: existing.id,
                savedBy: session.userId,
                savedByEmail: user?.email ?? '',
                changeSource: changeSource ?? 'manual_edit',
                segmentsSnap: segmentsStr,
                placementSnap: JSON.stringify(placement ?? {}),
            },
        })

        return NextResponse.json({ ok: true, status: newStatus })
    } catch (error) {
        console.error('[subtitles/PATCH] error:', error)
        return NextResponse.json({ error: 'Failed to save edits' }, { status: 500 })
    }
}

/**
 * PUT — Admin approves the source subtitle track.
 * Sets status = 'approved_source', gate required before translation can run.
 */
export async function PUT(req: NextRequest) {
    const session = await getUserSession()
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasAdminRole(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    try {
        const body = await req.json()
        const { projectId, episodeId } = body

        if (!projectId) {
            return NextResponse.json({ error: 'projectId required' }, { status: 400 })
        }

        const existing = await findSubtitle(projectId, episodeId || null)
        if (!existing) {
            return NextResponse.json({ error: 'No subtitle record found' }, { status: 404 })
        }

        await updateSubtitleById(existing.id, { status: 'approved_source' })

        // Save approve revision snapshot
        const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } })
        await prisma.subtitleRevision.create({
            data: {
                subtitleId: existing.id,
                savedBy: session.userId,
                savedByEmail: user?.email ?? '',
                changeSource: 'approve',
                segmentsSnap: existing.segments,
                placementSnap: JSON.stringify({}),
            },
        })

        return NextResponse.json({ ok: true, status: 'approved_source' })
    } catch (error) {
        console.error('[subtitles/PUT] error:', error)
        return NextResponse.json({ error: 'Failed to approve' }, { status: 500 })
    }
}
