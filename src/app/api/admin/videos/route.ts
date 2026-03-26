import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET: Fetch hero videos (public — filtered by page, or admin — all)
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const page = searchParams.get('page') || 'all'
    const isAdmin = searchParams.get('admin') === 'true'

    if (isAdmin) {
        // Admin view: return ALL videos (active + inactive)
        const videos = await prisma.heroVideo.findMany({
            orderBy: { sortOrder: 'asc' },
        })
        return NextResponse.json(videos)
    }

    // Public view: only active videos matching the page
    const videos = await prisma.heroVideo.findMany({
        where: {
            active: true,
            OR: [
                { page: 'all' },
                { page },
            ],
        },
        orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json(videos)
}


// POST: Create a new hero video (admin only)
export async function POST(req: NextRequest) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const body = await req.json()
    const { title, url, duration, page, active, sortOrder } = body

    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

    const video = await prisma.heroVideo.create({
        data: {
            title: title || '',
            url,
            duration: duration || 10,
            page: page || 'all',
            active: active !== false,
            sortOrder: sortOrder || 0,
        },
    })

    return NextResponse.json(video, { status: 201 })
}

// PUT: Update a hero video (admin only)
export async function PUT(req: NextRequest) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const body = await req.json()
    const { id, ...data } = body

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const video = await prisma.heroVideo.update({
        where: { id },
        data,
    })

    return NextResponse.json(video)
}

// DELETE: Remove a hero video (admin only)
export async function DELETE(req: NextRequest) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    await prisma.heroVideo.delete({ where: { id } })

    return NextResponse.json({ success: true })
}
