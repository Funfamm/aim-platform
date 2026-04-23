import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { translateAndSave } from '@/lib/translate'
import { notifyContentPublish } from '@/lib/notifications'

export async function GET() {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const projects = await prisma.project.findMany({
        orderBy: { sortOrder: 'asc' },
        take: 200,
        select: {
            id: true, title: true, slug: true, tagline: true, description: true,
            status: true, genre: true, year: true, duration: true,
            featured: true, published: true, sortOrder: true, coverImage: true,
            trailerUrl: true, filmUrl: true, projectType: true,
            gallery: true, credits: true, sponsorData: true,
            viewCount: true,
            _count: { select: { castingCalls: true } },
        },
    })

    return NextResponse.json(projects)
}

function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export async function POST(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const body = await req.json()

    if (!body.title || !body.description) {
        return NextResponse.json({ error: 'Title and description are required' }, { status: 400 })
    }

    const slug = body.slug || slugify(body.title)

    // Check for slug collision
    const existing = await prisma.project.findUnique({ where: { slug } })
    if (existing) {
        return NextResponse.json({ error: 'A project with this slug already exists' }, { status: 409 })
    }

    const maxOrder = await prisma.project.aggregate({ _max: { sortOrder: true } })

    const project = await prisma.project.create({
        data: {
            title: body.title,
            slug,
            tagline: body.tagline || '',
            description: body.description,
            status: body.status || 'upcoming',
            genre: body.genre || null,
            year: body.year || null,
            duration: body.duration || null,
            featured: body.featured ?? false,
            published: body.published ?? false,
            sortOrder: (maxOrder._max.sortOrder || 0) + 1,
            coverImage: body.coverImage || null,
            trailerUrl: body.trailerUrl || null,
            filmUrl: body.filmUrl || null,
            projectType: body.projectType || 'movie',
            gallery: body.gallery || null,
            credits: body.credits || null,
            sponsorData: body.sponsorData || null,
        },
        include: {
            _count: { select: { castingCalls: true } },
        },
    })

    // Fire-and-forget: translate content in background
    translateAndSave(
        { title: body.title, tagline: body.tagline || '', description: body.description, genre: body.genre || '' },
        async (translations) => {
            await prisma.project.update({ where: { id: project.id }, data: { translations } })
        },
        'all'
    )

    // Notify users if project is published immediately on creation
    if (project.published) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
        const projectStatus = project.status || 'completed'
        const pagePath = projectStatus === 'completed' ? `/en/works/${project.slug}/watch` : `/en/works/${project.slug}`
        const link = `${siteUrl}${pagePath}`
        let sponsorParsed: { name: string; logoUrl?: string; description?: string } | null = null
        try {
            if (body.sponsorData) sponsorParsed = typeof body.sponsorData === 'string' ? JSON.parse(body.sponsorData) : body.sponsorData
        } catch { /* ignore */ }
        // Read audience selection from admin form.
        // Default to nobody — admin must explicitly opt-in each group.
        const notifyGroups: { subscribers?: boolean; members?: boolean; cast?: boolean } = body.notifyGroups ?? {
            subscribers: false, members: false, cast: false,
        }
        try {
            await notifyContentPublish(project.title, project.projectType || 'project', link, projectStatus, sponsorParsed, notifyGroups, project.id)
        } catch (err) {
            console.error('[publish] notifyContentPublish failed (POST):', err)
        }
    }

    return NextResponse.json(project, { status: 201 })
}
