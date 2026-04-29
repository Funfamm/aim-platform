import { redirect, notFound } from 'next/navigation'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Footer from '@/components/Footer'
import WatchPlayer from '@/components/WatchPlayer'
import CommentSection from '@/components/comments/CommentSection'
import { getLocale } from 'next-intl/server'

export const dynamic = 'force-dynamic'

// Parse route params: s1e3 → { season: 1, episode: 3 }
function parseEpisodeSlug(slug: string): { season: number; episode: number } | null {
    const match = slug.match(/^s(\d+)e(\d+)$/)
    if (!match) return null
    return { season: Number(match[1]), episode: Number(match[2]) }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; episodeSlug: string }> }) {
    const { slug, episodeSlug } = await params
    const parsed = parseEpisodeSlug(episodeSlug)
    if (!parsed) return { title: 'Not Found' }

    const episode = await prisma.episode.findFirst({
        where: { project: { slug }, season: parsed.season, number: parsed.episode, published: true },
        include: { project: { select: { title: true, coverImage: true, slug: true } } },
    })
    if (!episode) return { title: 'Not Found' }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
    const epTitle = `${episode.title} — S${parsed.season}E${parsed.episode} | ${episode.project.title}`
    const epDesc = episode.description || `Watch ${episode.title} from ${episode.project.title}`
    const epImage = episode.thumbnail || episode.project.coverImage

    return {
        title: `${epTitle} | AIM Studio`,
        description: epDesc,
        openGraph: {
            title: epTitle,
            description: epDesc,
            images: epImage ? [{ url: epImage }] : [],
            url: `${siteUrl}/works/${slug}/${episodeSlug}`,
            type: 'video.episode',
        },
        twitter: {
            card: 'summary_large_image',
            title: epTitle,
            description: epDesc,
            images: epImage ? [epImage] : [],
        },
    }
}

export default async function EpisodePage({ params }: { params: Promise<{ slug: string; episodeSlug: string }> }) {
    const { slug, episodeSlug } = await params
    const parsed = parseEpisodeSlug(episodeSlug)
    if (!parsed) notFound()

    // Check requireLoginForFilms setting
    const session = await getUserSession()
    let requireLogin = true
    try {
        const ss = await prisma.siteSettings.findFirst({ select: { requireLoginForFilms: true } })
        if (ss) requireLogin = ss.requireLoginForFilms
    } catch { /* schema drift safe */ }

    // Auth gate — follows requireLoginForFilms toggle
    if (requireLogin && !session?.userId) {
        const locale = await getLocale()
        redirect(`/${locale}/login?redirect=/works/${slug}/${episodeSlug}`)
    }

    // Fetch project with all published episodes (WatchPlayer needs full array for navigation)
    const project = await prisma.project.findUnique({
        where: { slug },
        select: {
            id: true,
            title: true,
            slug: true,
            tagline: true,
            description: true,
            genre: true,
            year: true,
            duration: true,
            coverImage: true,
            filmUrl: true,
            trailerUrl: true,
            projectType: true,
            status: true,
            published: true,
            translations: true,
            episodes: {
                where: { published: true },
                orderBy: [{ season: 'asc' }, { number: 'asc' }],
            },
        },
    })

    if (!project || !project.published) notFound()

    // Find the target episode
    const targetEpisode = project.episodes.find(
        e => e.season === parsed.season && e.number === parsed.episode
    )
    if (!targetEpisode) notFound()

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'

    // JSON-LD structured data for episode
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'TVEpisode',
        name: targetEpisode.title,
        episodeNumber: targetEpisode.number,
        description: targetEpisode.description || undefined,
        image: targetEpisode.thumbnail || project.coverImage,
        url: `${siteUrl}/works/${slug}/${episodeSlug}`,
        partOfSeason: {
            '@type': 'TVSeason',
            seasonNumber: targetEpisode.season,
        },
        partOfSeries: {
            '@type': 'TVSeries',
            name: project.title,
            url: `${siteUrl}/works/${slug}`,
        },
    }

    // Cast to WatchPlayer's WatchProject interface — Prisma select type is
    // structurally compatible but TypeScript can't infer the exact match
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const watchProject = project as any
    const locale = await getLocale()

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <WatchPlayer
                project={watchProject}
                startEpisodeId={targetEpisode.id}
                userPreferredLang={locale || 'en'}
            />
            <CommentSection
                projectId={project.id}
                projectSlug={project.slug}
                episodeId={targetEpisode.id}
                currentUserId={session?.userId || null}
                currentUserRole={session?.role || null}
            />
            <Footer />
        </>
    )
}
