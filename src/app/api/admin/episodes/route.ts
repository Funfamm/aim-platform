import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'

function isAdmin(role: string) {
    return role === 'admin' || role === 'superadmin'
}

// ── GET: List episodes for a project ────────────────────────────────────────
export async function GET(req: Request) {
    const session = await getUserSession()
    if (!session?.userId || !isAdmin(session.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) {
        return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const episodes = await prisma.episode.findMany({
        where: { projectId },
        orderBy: [{ season: 'asc' }, { number: 'asc' }],
    })

    return NextResponse.json({ episodes })
}

// ── POST: Create an episode ─────────────────────────────────────────────────
export async function POST(req: Request) {
    const session = await getUserSession()
    if (!session?.userId || !isAdmin(session.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json()
        const { projectId, title, number, season, videoUrl, duration, description, thumbnail, published } = body

        if (!projectId || !title || number === undefined) {
            return NextResponse.json({ error: 'projectId, title, and number are required' }, { status: 400 })
        }

        const episode = await prisma.episode.create({
            data: {
                projectId,
                title,
                number: Number(number),
                season: Number(season) || 1,
                videoUrl: videoUrl || null,
                duration: duration || null,
                description: description || null,
                thumbnail: thumbnail || null,
                published: published ?? false,
            },
        })

        return NextResponse.json({ episode }, { status: 201 })
    } catch (err: any) {
        if (err?.code === 'P2002') {
            return NextResponse.json({ error: 'Episode with this season and number already exists' }, { status: 409 })
        }
        console.error('[admin/episodes] POST error:', err)
        return NextResponse.json({ error: 'Failed to create episode' }, { status: 500 })
    }
}

// ── PUT: Update an episode ──────────────────────────────────────────────────
export async function PUT(req: Request) {
    const session = await getUserSession()
    if (!session?.userId || !isAdmin(session.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json()
        const { id, ...fields } = body

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 })
        }

        const data: Record<string, unknown> = {}
        if (fields.title !== undefined) data.title = fields.title
        if (fields.number !== undefined) data.number = Number(fields.number)
        if (fields.season !== undefined) data.season = Number(fields.season)
        if (fields.videoUrl !== undefined) data.videoUrl = fields.videoUrl || null
        if (fields.duration !== undefined) data.duration = fields.duration || null
        if (fields.description !== undefined) data.description = fields.description || null
        if (fields.thumbnail !== undefined) data.thumbnail = fields.thumbnail || null
        if (fields.published !== undefined) data.published = Boolean(fields.published)

        const episode = await prisma.episode.update({
            where: { id },
            data,
        })

        return NextResponse.json({ episode })
    } catch (err: any) {
        if (err?.code === 'P2002') {
            return NextResponse.json({ error: 'Episode with this season and number already exists' }, { status: 409 })
        }
        console.error('[admin/episodes] PUT error:', err)
        return NextResponse.json({ error: 'Failed to update episode' }, { status: 500 })
    }
}

// ── DELETE: Remove an episode ───────────────────────────────────────────────
export async function DELETE(req: Request) {
    const session = await getUserSession()
    if (!session?.userId || !isAdmin(session.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    try {
        await prisma.episode.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[admin/episodes] DELETE error:', err)
        return NextResponse.json({ error: 'Failed to delete episode' }, { status: 500 })
    }
}
