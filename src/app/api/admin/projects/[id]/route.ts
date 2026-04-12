import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { translateAndSave } from '@/lib/translate'
import { notifyContentPublish } from '@/lib/notifications'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { id } = await params
    const body = await req.json()

    // Capture prior status so we only notify on the transition to 'published'
    const prior = await prisma.project.findUnique({ where: { id }, select: { status: true, slug: true } })

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
            },
            'all'
        )
    }

    // Fire-and-forget: notify users when status transitions to 'published'
    if (body.status === 'published' && prior?.status !== 'published') {
        const link = `/works/${project.slug}`
        notifyContentPublish(project.title, project.projectType || 'project', link).catch(() => {})
    }

    return NextResponse.json(project)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { id } = await params

    await prisma.project.delete({ where: { id } })

    return NextResponse.json({ success: true })
}
