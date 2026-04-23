import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { translateAndSave } from '@/lib/translate'
import { notifyContentPublish } from '@/lib/notifications'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { id } = await params
    const body = await req.json()

    // Capture prior published state so we only notify on the transition to published
    const prior = await prisma.project.findUnique({ where: { id }, select: { published: true, slug: true } })

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
            ...(body.published !== undefined && { published: body.published }),
            ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
            ...(body.coverImage !== undefined && { coverImage: body.coverImage || null }),
            ...(body.trailerUrl !== undefined && { trailerUrl: body.trailerUrl || null }),
            ...(body.filmUrl !== undefined && { filmUrl: body.filmUrl || null }),
            ...(body.projectType !== undefined && { projectType: body.projectType }),
            ...(body.gallery !== undefined && { gallery: body.gallery || null }),
            ...(body.credits !== undefined && { credits: body.credits || null }),
            ...(body.sponsorData !== undefined && { sponsorData: body.sponsorData || null }),
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

    // Fire-and-forget: notify users when project is newly published
    if (body.published === true && !prior?.published) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
        const projectStatus = body.status ?? project.status ?? 'completed'
        const pagePath = projectStatus === 'completed' ? `/en/works/${project.slug}/watch` : `/en/works/${project.slug}`
        const link = `${siteUrl}${pagePath}`
        let sponsorParsed: { name: string; logoUrl?: string; description?: string } | null = null
        try {
            const sd = body.sponsorData || (project as Record<string, unknown>).sponsorData
            if (sd) sponsorParsed = typeof sd === 'string' ? JSON.parse(sd) : sd
        } catch { /* ignore malformed */ }
        // Await the notification BEFORE returning — Vercel kills fire-and-forget promises
        // immediately after the response is sent in serverless environments.
        try {
            await notifyContentPublish(project.title, project.projectType || 'project', link, projectStatus, sponsorParsed)
        } catch (err) {
            console.error('[publish] notifyContentPublish failed:', err)
        }
    }

    return NextResponse.json(project)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { id } = await params

    await prisma.project.delete({ where: { id } })

    return NextResponse.json({ success: true })
}
