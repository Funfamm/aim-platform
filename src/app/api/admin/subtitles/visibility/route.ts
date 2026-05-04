import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { hasAdminRole } from '@/lib/roles'

// PATCH /api/admin/subtitles/visibility
// Body: { projectId, mediaType, episodeId?, subtitlesPublic }
// Sets FilmSubtitle.subtitlesPublic for a specific track (movie | trailer | episode)
export async function PATCH(req: NextRequest) {
    const session = await getUserSession()
    if (!session?.userId || !hasAdminRole(session.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { projectId, mediaType, episodeId, subtitlesPublic } = body

    if (!projectId || !mediaType || typeof subtitlesPublic !== 'boolean') {
        return NextResponse.json({ error: 'projectId, mediaType, and subtitlesPublic are required' }, { status: 400 })
    }

    const updated = await prisma.filmSubtitle.updateMany({
        where: {
            projectId,
            mediaType,
            episodeId: episodeId ?? null,
        },
        data: { subtitlesPublic },
    })

    if (updated.count === 0) {
        return NextResponse.json({ error: 'No subtitle track found for that media type' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, updated: updated.count, subtitlesPublic })
}
