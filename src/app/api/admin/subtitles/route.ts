import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { hasAdminRole } from '@/lib/roles'
import { findSubtitle, updateSubtitleById, upsertSubtitle } from '@/lib/subtitle-repo'
import { upsertSubtitleRecord } from '@/lib/subtitle-status-service'

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
    const denied = await requireAdmin()
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

    try {
        const body = await req.json()
        const { projectId, episodeId, segments } = body

        if (!projectId || !segments) {
            return NextResponse.json({ error: 'projectId and segments required' }, { status: 400 })
        }

        const existing = await findSubtitle(projectId, episodeId || null)
        if (!existing) {
            return NextResponse.json({ error: 'No subtitle record found' }, { status: 404 })
        }

        const segmentsStr = typeof segments === 'string' ? segments : JSON.stringify(segments)

        // If previously approved, edits reset the approval (must re-approve before translate)
        const newStatus = existing.status === 'approved_source' ? 'pending' : (existing.status ?? 'pending')

        // Call upsertSubtitle directly (not the service) so we can explicitly set
        // translateStatus:'pending' — the service would re-derive 'complete' from
        // the still-present translations blob, which defeats the approval gate.
        await upsertSubtitle({
            projectId,
            episodeId: episodeId || null,
            language: existing.language ?? 'en',
            segments: segmentsStr,
            translations: existing.translations as string | null,
            status: newStatus,
            translateStatus: 'pending',  // explicit — blocks translate until re-approval
            transcribedWith: existing.transcribedWith ?? undefined,
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
    const denied = await requireAdmin()
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

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

        return NextResponse.json({ ok: true, status: 'approved_source' })
    } catch (error) {
        console.error('[subtitles/PUT] error:', error)
        return NextResponse.json({ error: 'Failed to approve' }, { status: 500 })
    }
}
