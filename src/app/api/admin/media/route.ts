import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

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

    // All types now support comma-separated page values so admins can assign
    // a single asset to multiple pages from the Media Manager.
    // Use OR logic: match 'all' OR any record whose page field contains the
    // requested page. A post-filter step then eliminates false-positives
    // (e.g. "casting" inside "forecasting").
    if (page) {
        where.OR = [
            { page: 'all' },
            { page: { contains: page } },
        ]
    }

    const media = await prisma.pageMedia.findMany({
        where: where as never,
        orderBy: { sortOrder: 'asc' },
        take: 200,
    })

    // Post-filter: split comma-separated page lists and check exact membership.
    if (page) {
        const filtered = media.filter((m: { page: string }) => {
            if (m.page === 'all') return true
            const pages = m.page.split(',').map((p: string) => p.trim())
            return pages.includes(page)
        })
        const res = NextResponse.json(filtered)
        // Cache public media responses — these rarely change and are fetched
        // on every page load. 5 min fresh + 1 hour stale-while-revalidate
        // eliminates the DB round-trip on repeat visits.
        if (!isAdmin) {
            res.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600')
        }
        return res
    }

    const res = NextResponse.json(media)
    if (!isAdmin) {
        res.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600')
    }
    return res
}

// POST: create new page media (admin)
export async function POST(req: NextRequest) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const body = await req.json()
        const { page, type, url, title, sortOrder, active, duration, target } = body

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
            duration: duration || 10,
            target: target || 'all',
        }

        const media = await prisma.pageMedia.create({ data: data as never })

        // Bust Vercel edge cache so the change appears on the live site immediately
        revalidatePath('/api/admin/media')

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

    // Bust Vercel edge cache so the change appears on the live site immediately
    revalidatePath('/api/admin/media')

    return NextResponse.json(media)
}

// DELETE: remove page media (admin)
export async function DELETE(req: NextRequest) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    await prisma.pageMedia.delete({ where: { id } })

    // Bust Vercel edge cache so the deletion is reflected immediately
    revalidatePath('/api/admin/media')

    return NextResponse.json({ success: true })
}
