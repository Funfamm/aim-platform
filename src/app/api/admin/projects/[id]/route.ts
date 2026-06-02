import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { translateAndSave } from '@/lib/translate'
import { notifyContentPublish } from '@/lib/notifications'
import { revalidatePath } from 'next/cache'

// Supported locales (must match src/i18n/routing.ts).
// English uses no prefix (localePrefix: as-needed); all others use /XX prefix.
const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'ar', 'zh', 'hi', 'pt', 'ru', 'ja', 'de', 'ko']

/** Revalidate all ISR pages that can be affected by a project change. */
function revalidateProjectPages(newSlug: string, oldSlug: string | null | undefined) {
    // Root-layout purge covers the entire page tree in one call (homepage, works
    // list, about, upcoming, and all locale variants via the [locale] segment).
    revalidatePath('/', 'layout')

    // Belt-and-suspenders: explicitly purge work-detail pages for old + new slug
    // across every locale so the 1-hour ISR cache is guaranteed to clear.
    const slugsToClear: string[] = [newSlug]
    if (oldSlug && oldSlug !== newSlug) slugsToClear.push(oldSlug)

    for (const slug of slugsToClear) {
        for (const locale of SUPPORTED_LOCALES) {
            const prefix = locale === 'en' ? '' : ('/' + locale)
            revalidatePath(prefix + '/works/' + slug, 'page')
        }
    }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { id } = await params
    const body = await req.json()

    // Capture prior state so we only notify on the transition to published
    const prior = await prisma.project.findUnique({ where: { id }, select: { published: true, slug: true } })

    let project
    try {
        project = await prisma.project.update({
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
                ...(body.featuredWorks !== undefined && { featuredWorks: body.featuredWorks }),
                ...(body.published !== undefined && { published: body.published }),
                ...(body.subtitlesPublic !== undefined && { subtitlesPublic: body.subtitlesPublic }),
                // Clear publishAt when manually publishing
                ...(body.published === true && { publishAt: null }),
                // Save publishAt when scheduling
                ...('publishAt' in body && body.published !== true && { publishAt: body.publishAt ? new Date(body.publishAt) : null }),
                // Persist audience selection for scheduled publish
                ...('publishNotifyGroups' in body && { publishNotifyGroups: body.publishNotifyGroups || null }),
                ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
                ...(body.coverImage !== undefined && { coverImage: body.coverImage || null }),
                ...(body.mobileCoverImage !== undefined && { mobileCoverImage: body.mobileCoverImage || null }),
                ...(body.mobileGallery !== undefined && { mobileGallery: body.mobileGallery || null }),
                ...(body.trailerUrl !== undefined && { trailerUrl: body.trailerUrl || null }),
                ...(body.filmUrl !== undefined && { filmUrl: body.filmUrl || null }),
                ...(body.projectType !== undefined && { projectType: body.projectType }),
                ...(body.gallery !== undefined && { gallery: body.gallery || null }),
                ...(body.credits !== undefined && { credits: body.credits || null }),
                ...(body.sponsorData !== undefined && { sponsorData: body.sponsorData || null }),
                // Content Advisory
                ...(body.contentRating !== undefined && { contentRating: body.contentRating || null }),
                ...(body.contentDescriptors !== undefined && { contentDescriptors: body.contentDescriptors ?? [] }),
                ...('advisoryDisplaySeconds' in body && { advisoryDisplaySeconds: body.advisoryDisplaySeconds }),
                // Player Timings
                ...('introStartSeconds' in body && { introStartSeconds: body.introStartSeconds }),
                ...('introEndSeconds' in body && { introEndSeconds: body.introEndSeconds }),
                ...('creditsStartSeconds' in body && { creditsStartSeconds: body.creditsStartSeconds }),
            },
            include: {
                _count: { select: { castingCalls: true } },
            },
        })
    } catch (err: unknown) {
        // P2002 = unique constraint violation (slug collision)
        const isPrismaP2002 =
            typeof err === 'object' && err !== null &&
            'code' in err && (err as { code: string }).code === 'P2002'
        if (isPrismaP2002) {
            return NextResponse.json(
                { error: 'A project with this slug already exists. Choose a different URL slug.' },
                { status: 409 }
            )
        }
        throw err
    }

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

    // Notify selected audience when project is newly published
    if (body.published === true && !prior?.published) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
        const projectStatus = body.status ?? project.status ?? 'completed'
        const pagePath = projectStatus === 'completed' ? '/en/works/' + project.slug + '/watch' : '/en/works/' + project.slug
        const link = siteUrl + pagePath
        let sponsorParsed: { name: string; logoUrl?: string; description?: string } | null = null
        try {
            const sd = body.sponsorData || (project as Record<string, unknown>).sponsorData
            if (sd) sponsorParsed = typeof sd === 'string' ? JSON.parse(sd) : sd
        } catch { /* ignore malformed */ }
        const notifyGroups: { subscribers?: boolean; members?: boolean; cast?: boolean } = body.notifyGroups ?? {
            subscribers: false, members: false, cast: false,
        }
        const projWithTranslations = await prisma.project.findUnique({
            where: { id },
            select: { translations: true },
        })
        try {
            await notifyContentPublish(project.title, project.projectType || 'project', link, projectStatus, sponsorParsed, notifyGroups, id, projWithTranslations?.translations)
        } catch (err) {
            console.error('[publish] notifyContentPublish failed:', err)
        }

        // Auto-disable release CTAs on publish
        try {
            const result = await prisma.ctaConfiguration.updateMany({
                where: { videoId: id, notificationType: 'release', status: 'active' },
                data: { status: 'auto_disabled_post_release' },
            })
            if (result.count > 0) {
                console.log('[publish] Auto-disabled ' + result.count + ' release CTA(s) for project ' + id)
            }
        } catch (err) {
            console.error('[publish] Failed to auto-disable release CTAs:', err)
        }
    }

    // Revalidate all affected public ISR pages (unconditional: any field change
    // should be visible immediately, including description, genre, timings, etc.)
    revalidateProjectPages(project.slug, prior?.slug)

    return NextResponse.json(project)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { id } = await params

    const prior = await prisma.project.findUnique({ where: { id }, select: { slug: true } })
    await prisma.project.delete({ where: { id } })

    // Bust all public ISR caches after deletion
    revalidateProjectPages(prior?.slug ?? '', null)

    return NextResponse.json({ success: true })
}
