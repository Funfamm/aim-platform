import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { hasAdminRole } from '@/lib/roles'

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

    const subtitle = await prisma.filmSubtitle.findFirst({
        where: {
            projectId,
            episodeId: episodeId || null,
        },
    })

    return NextResponse.json({ subtitle })
}

// POST — save/update subtitles (called after browser transcription completes)
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

        const existing = await prisma.filmSubtitle.findFirst({
            where: {
                projectId,
                episodeId: episodeId || null,
            },
        })

        let subtitle
        if (existing) {
            subtitle = await prisma.filmSubtitle.update({
                where: { id: existing.id },
                data: {
                    language: language || 'en',
                    segments: segmentsStr,
                    translations: translationsStr,
                    status: status || 'completed',
                    // Preserve partial translate status if re-transcribing — don't wipe resume state
                    translateStatus: translationsStr ? 'complete' : (existing.translateStatus === 'partial' || existing.translateStatus === 'complete' ? existing.translateStatus : 'pending'),
                    transcribedWith: transcribedWith || 'whisper-medium',
                    qcIssues: qcIssuesStr,
                },
            })
        } else {
            subtitle = await prisma.filmSubtitle.create({
                data: {
                    projectId,
                    episodeId: episodeId || null,
                    language: language || 'en',
                    segments: segmentsStr,
                    translations: translationsStr,
                    status: status || 'completed',
                    translateStatus: translationsStr ? 'complete' : 'pending',
                    transcribedWith: transcribedWith || 'whisper-medium',
                    qcIssues: qcIssuesStr,
                },
            })
        }

        return NextResponse.json({ subtitle })
    } catch (error) {
        console.error('Subtitle save error:', error)
        return NextResponse.json({ error: 'Failed to save subtitles' }, { status: 500 })
    }
}
