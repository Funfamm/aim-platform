import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { hasAdminRole } from '@/lib/roles'
import { findSubtitle } from '@/lib/subtitle-repo'
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

        // ── Delegated to status service (SRP fix: business logic lives in service, not repo) ──
        // upsertSubtitleRecord computes the correct translateStatus before calling the repo.
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
