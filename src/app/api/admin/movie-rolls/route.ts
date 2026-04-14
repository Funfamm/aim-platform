import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// GET /api/admin/movie-rolls — list all rolls with project counts
export async function GET() {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const rolls = await prisma.movieRoll.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
            projects: {
                orderBy: { sortOrder: 'asc' },
                select: {
                    id: true,
                    projectId: true,
                    sortOrder: true,
                },
            },
            _count: { select: { projects: true } },
        },
    })

    return NextResponse.json(rolls)
}

// POST /api/admin/movie-rolls — create a new roll
export async function POST(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const body = await req.json()

    if (!body.title) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const slug = body.slug || slugify(body.title)

    // Check slug uniqueness
    const existing = await prisma.movieRoll.findUnique({ where: { slug } })
    if (existing) {
        return NextResponse.json({ error: 'A roll with this slug already exists' }, { status: 409 })
    }

    const roll = await prisma.movieRoll.create({
        data: {
            title: body.title,
            titleI18n: body.titleI18n || null,
            icon: body.icon || '🎬',
            slug,
            displayOn: body.displayOn || 'both',
            visible: body.visible ?? true,
            sortOrder: body.sortOrder ?? 0,
        },
    })

    return NextResponse.json(roll, { status: 201 })
}

// PUT /api/admin/movie-rolls — update a roll
export async function PUT(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const body = await req.json()

    if (!body.id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const roll = await prisma.movieRoll.update({
        where: { id: body.id },
        data: {
            ...(body.title !== undefined && { title: body.title }),
            ...(body.titleI18n !== undefined && { titleI18n: body.titleI18n }),
            ...(body.icon !== undefined && { icon: body.icon }),
            ...(body.slug !== undefined && { slug: body.slug }),
            ...(body.displayOn !== undefined && { displayOn: body.displayOn }),
            ...(body.visible !== undefined && { visible: body.visible }),
            ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
        },
    })

    return NextResponse.json(roll)
}

// DELETE /api/admin/movie-rolls — delete a roll (cascades to join table)
export async function DELETE(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    await prisma.movieRoll.delete({ where: { id } })

    return NextResponse.json({ ok: true })
}
