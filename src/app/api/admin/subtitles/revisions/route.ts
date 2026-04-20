import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { hasAdminRole } from '@/lib/roles'
import { prisma } from '@/lib/db'
import { findSubtitle } from '@/lib/subtitle-repo'

async function requireAdmin() {
    const session = await getUserSession()
    if (!session?.userId) return { error: 'Unauthorized', status: 401, session: null }
    if (!hasAdminRole(session.role)) return { error: 'Forbidden', status: 403, session: null }
    return { error: null, status: 200, session }
}

// GET — list revision history for a subtitle track
// ?projectId=xxx&episodeId=yyy
export async function GET(req: NextRequest) {
    const { error, status } = await requireAdmin()
    if (error) return NextResponse.json({ error }, { status })

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const episodeId = searchParams.get('episodeId') || null

    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

    const subtitle = await findSubtitle(projectId, episodeId)
    if (!subtitle) return NextResponse.json({ revisions: [] })

    const revisions = await prisma.subtitleRevision.findMany({
        where: { subtitleId: subtitle.id },
        orderBy: { savedAt: 'desc' },
        take: 50,
        select: {
            id: true,
            savedAt: true,
            savedBy: true,
            savedByEmail: true,
            changeSource: true,
            placementSnap: true,
            // segmentsSnap is large — only return on explicit restore request
        },
    })

    return NextResponse.json({ revisions })
}

// POST — save a new revision snapshot (called by the editor on draft save / approve / import)
export async function POST(req: NextRequest) {
    const { error, status, session } = await requireAdmin()
    if (error || !session) return NextResponse.json({ error }, { status })

    try {
        const body = await req.json() as {
            projectId: string
            episodeId?: string | null
            segments: Array<{ start: number; end: number; text: string }>
            changeSource: string
            placement?: {
                verticalAnchor?: string
                horizontalAlign?: string
                offsetYPercent?: number
                offsetXPercent?: number
                safeAreaMarginPx?: number
                backgroundStyle?: string
                fontScale?: number
                cueOverrides?: Record<string, unknown>
            }
        }

        const { projectId, episodeId, segments, changeSource, placement } = body
        if (!projectId || !segments || !changeSource) {
            return NextResponse.json({ error: 'projectId, segments, changeSource required' }, { status: 400 })
        }

        const subtitle = await findSubtitle(projectId, episodeId || null)
        if (!subtitle) return NextResponse.json({ error: 'Subtitle record not found' }, { status: 404 })

        // Fetch editor email for display
        const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { email: true },
        })

        const revision = await prisma.subtitleRevision.create({
            data: {
                subtitleId: subtitle.id,
                savedBy: session.userId,
                savedByEmail: user?.email ?? '',
                changeSource,
                segmentsSnap: JSON.stringify(segments),
                placementSnap: JSON.stringify(placement ?? {}),
            },
        })

        return NextResponse.json({ ok: true, revisionId: revision.id })
    } catch (err) {
        console.error('[revisions/POST]', err)
        return NextResponse.json({ error: 'Failed to save revision' }, { status: 500 })
    }
}

// PATCH — restore a specific revision (returns the segment snapshot)
export async function PATCH(req: NextRequest) {
    const { error, status } = await requireAdmin()
    if (error) return NextResponse.json({ error }, { status })

    try {
        const { revisionId } = await req.json() as { revisionId: string }
        if (!revisionId) return NextResponse.json({ error: 'revisionId required' }, { status: 400 })

        const revision = await prisma.subtitleRevision.findUnique({
            where: { id: revisionId },
        })
        if (!revision) return NextResponse.json({ error: 'Revision not found' }, { status: 404 })

        const segments = JSON.parse(revision.segmentsSnap) as Array<{ start: number; end: number; text: string }>
        const placement = JSON.parse(revision.placementSnap) as Record<string, unknown>

        return NextResponse.json({
            ok: true,
            segments,
            placement,
            savedAt: revision.savedAt,
            savedByEmail: revision.savedByEmail,
            changeSource: revision.changeSource,
        })
    } catch (err) {
        console.error('[revisions/PATCH]', err)
        return NextResponse.json({ error: 'Failed to restore revision' }, { status: 500 })
    }
}
