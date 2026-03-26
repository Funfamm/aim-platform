import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET: fetch media (optionally filtered)
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const page = searchParams.get('page')
    const type = searchParams.get('type')
    const isAdmin = searchParams.get('admin') === 'true'

    // Admin requests require auth
    if (isAdmin) {
        try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }

    const where: Record<string, unknown> = {}
    if (!isAdmin) where.active = true
    if (type) where.type = type

    // Hero videos use comma-separated page values (e.g. "all", "casting,upcoming")
    // so we need OR logic: match 'all' OR any that contain the requested page
    if (page && type === 'hero-video') {
        where.OR = [
            { page: 'all' },
            { page: { contains: page } },
        ]
    } else if (page) {
        where.page = page
    }

    const media = await prisma.pageMedia.findMany({
        where: where as never,
        orderBy: { sortOrder: 'asc' },
        take: 200,
    })

    // For hero-video with a specific page, post-filter to handle edge cases
    // e.g. "casting" should not match "forecasting" in comma-separated values
    if (page && type === 'hero-video') {
        const filtered = media.filter((m: { page: string }) => {
            if (m.page === 'all') return true
            const pages = m.page.split(',').map(p => p.trim())
            return pages.includes(page)
        })
        return NextResponse.json(filtered)
    }

    return NextResponse.json(media)
}

// POST: create new page media (admin)
export async function POST(req: NextRequest) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const body = await req.json()
        const { page, type, url, title, sortOrder, active, duration } = body

        if (!page || !url) {
            return NextResponse.json({ error: 'Page and URL are required' }, { status: 400 })
        }

        const data: Record<string, unknown> = {
            page,
            type: type || 'background',
            url,
            title: title || '',
            sortOrder: sortOrder || 0,
            active: active !== false,
        }
        // Only include duration if it's a hero-video type
        if (type === 'hero-video') {
            data.duration = duration || 10
        }

        const media = await prisma.pageMedia.create({ data: data as never })

        return NextResponse.json(media, { status: 201 })
    } catch (err: unknown) {
        console.error('POST /api/admin/media error:', err)
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

// PUT: update page media (admin)
export async function PUT(req: NextRequest) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const body = await req.json()
    const { id, ...data } = body
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const media = await prisma.pageMedia.update({
        where: { id },
        data,
    })

    return NextResponse.json(media)
}

// DELETE: remove page media (admin)
export async function DELETE(req: NextRequest) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    await prisma.pageMedia.delete({ where: { id } })
    return NextResponse.json({ success: true })
}
