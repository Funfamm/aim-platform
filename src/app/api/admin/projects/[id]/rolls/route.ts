import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/admin/projects/[id]/rolls
 * Returns an array of rollIds that this project currently belongs to.
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { id: projectId } = await params

    const entries = await prisma.movieRollProject.findMany({
        where: { projectId },
        select: { rollId: true },
    })

    return NextResponse.json(entries.map(e => e.rollId))
}

/**
 * PUT /api/admin/projects/[id]/rolls
 * Body: { rollIds: string[] }
 * Replaces the project's roll assignments atomically.
 */
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { id: projectId } = await params
    const body = await req.json()

    if (!Array.isArray(body.rollIds)) {
        return NextResponse.json({ error: 'rollIds must be an array' }, { status: 400 })
    }

    const rollIds: string[] = body.rollIds

    await prisma.$transaction(async (tx) => {
        // Remove all existing assignments for this project
        await tx.movieRollProject.deleteMany({ where: { projectId } })

        // Re-insert desired assignments — use current count in each roll as sort order
        for (const rollId of rollIds) {
            const existing = await tx.movieRollProject.count({ where: { rollId } })
            await tx.movieRollProject.create({
                data: { rollId, projectId, sortOrder: existing },
            })
        }
    })

    return NextResponse.json({ ok: true, rollIds })
}
