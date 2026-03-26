import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { translateAndSave } from '@/lib/translate'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { id } = await params
    const body = await req.json()

    const project = await prisma.project.update({
        where: { id },
        data: {
            ...(body.title !== undefined && { title: body.title }),
            ...(body.slug !== undefined && { slug: body.slug }),
            ...(body.tagline !== undefined && { tagline: body.tagline }),
            ...(body.description !== undefined && { description: body.description }),
            ...(body.status !== undefined && { status: body.status }),
            ...(body.genre !== undefined && { genre: body.genre || null }),
            ...(body.year !== undefined && { year: body.year || null }),
            ...(body.duration !== undefined && { duration: body.duration || null }),
            ...(body.featured !== undefined && { featured: body.featured }),
            ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
            ...(body.coverImage !== undefined && { coverImage: body.coverImage || null }),
            ...(body.trailerUrl !== undefined && { trailerUrl: body.trailerUrl || null }),
            ...(body.filmUrl !== undefined && { filmUrl: body.filmUrl || null }),
            ...(body.projectType !== undefined && { projectType: body.projectType }),
        },
        include: {
            _count: { select: { castingCalls: true } },
        },
    })

    // Re-translate if text content changed
    if (body.title !== undefined || body.tagline !== undefined || body.description !== undefined || body.genre !== undefined) {
        translateAndSave(
            { title: project.title, tagline: project.tagline, description: project.description, genre: project.genre || '' },
            async (translations) => {
                await prisma.project.update({ where: { id }, data: { translations } })
            }
        )
    }

    return NextResponse.json(project)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { id } = await params

    await prisma.project.delete({ where: { id } })

    return NextResponse.json({ success: true })
}
