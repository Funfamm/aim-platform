import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

// POST /api/admin/movie-rolls/projects — add a project to a roll
export async function POST(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const body = await req.json()

    if (!body.rollId || !body.projectId) {
        return NextResponse.json({ error: 'rollId and projectId are required' }, { status: 400 })
    }

    // Get the next sort order
    const maxOrder = await prisma.movieRollProject.findFirst({
        where: { rollId: body.rollId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
    })

    const entry = await prisma.movieRollProject.create({
        data: {
            rollId: body.rollId,
            projectId: body.projectId,
            sortOrder: body.sortOrder ?? ((maxOrder?.sortOrder ?? -1) + 1),
        },
    })

    return NextResponse.json(entry, { status: 201 })
}

// PUT /api/admin/movie-rolls/projects — reorder projects in a roll
export async function PUT(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const body = await req.json()

    // Expects: { rollId: string, order: string[] } — array of projectIds in desired order
    if (!body.rollId || !Array.isArray(body.order)) {
        return NextResponse.json({ error: 'rollId and order[] are required' }, { status: 400 })
    }

    const updates = body.order.map((projectId: string, idx: number) =>
        prisma.movieRollProject.updateMany({
            where: { rollId: body.rollId, projectId },
            data: { sortOrder: idx },
        })
    )

    await prisma.$transaction(updates)

    return NextResponse.json({ ok: true })
}

// DELETE /api/admin/movie-rolls/projects — remove a project from a roll
export async function DELETE(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { searchParams } = new URL(req.url)
    const rollId = searchParams.get('rollId')
    const projectId = searchParams.get('projectId')

    if (!rollId || !projectId) {
        return NextResponse.json({ error: 'rollId and projectId are required' }, { status: 400 })
    }

    await prisma.movieRollProject.deleteMany({
        where: { rollId, projectId },
    })

    return NextResponse.json({ ok: true })
}
