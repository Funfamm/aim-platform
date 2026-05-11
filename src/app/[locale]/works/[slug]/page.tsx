import { notFound } from 'next/navigation'
import Footer from '@/components/Footer'
import ProjectDetailClient from '@/components/ProjectDetailClient2'
import CastShowcase from '@/components/CastShowcase'
import { prisma } from '@/lib/db'
import { cache } from 'react'

// 1 hour — admin updates call revalidatePath() immediately.
// getUserSession() was removed — reading cookies forced dynamic rendering,
// making revalidate=3600 useless. Auth is handled client-side.
export const revalidate = 3600

// Cache project query to share between generateMetadata and page render
const getProject = cache(async (slug: string) => {
    return prisma.project.findUnique({
        where: { slug },
        include: {
            castingCalls: {
                where: { status: 'open' },
            },
            cast: {
                orderBy: { sortOrder: 'asc' },
            },
            episodes: {
                where: { published: true },
                orderBy: [{ season: 'asc' }, { number: 'asc' }],
            },
        },
    })
})

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const project = await getProject(slug)
    if (!project) return { title: 'Not Found' }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
    const desc = project.tagline || project.description.slice(0, 160)
    return {
        title: `${project.title} | AIM Studio`,
        description: desc,
        openGraph: {
            title: project.title,
            description: desc,
            images: project.coverImage ? [{ url: project.coverImage }] : [],
            url: `${siteUrl}/works/${project.slug}`,
            type: 'video.movie',
        },
        twitter: {
            card: 'summary_large_image',
            title: project.title,
            description: desc,
            images: project.coverImage ? [project.coverImage] : [],
        },
    }
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params

    // Run DB calls in parallel — no getUserSession() so ISR actually caches
    const [project, siteSettings] = await Promise.all([
        getProject(slug),
        prisma.siteSettings.findFirst({ select: { allowPublicTrailers: true } }).catch(() => null),
    ])

    if (!project || !project.published) notFound()

    // Trailer access: public trailers controlled by site setting.
    // Logged-in users always see trailers — handled in ProjectDetailClient2 via /api/auth/me.
    const siteAllowTrailers = siteSettings?.allowPublicTrailers ?? true
    const showTrailer = siteAllowTrailers

    // Serialize dates for client component
    const hasTrailer = !!project.trailerUrl
    const serializedProject = {
        ...project,
        trailerUrl: showTrailer ? project.trailerUrl : null,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        castingCalls: project.castingCalls.map(c => ({
            ...c,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
        })),
        episodes: project.episodes.map(e => ({
            ...e,
            createdAt: e.createdAt.toISOString(),
        })),
        cast: project.cast.map(m => ({
            ...m,
            createdAt: m.createdAt.toISOString(),
        })),
    }

    // Direct to specific apply page when one call, or listing when multiple
    const castingHref = project.castingCalls.length === 1
        ? `/casting/${project.castingCalls[0].id}/apply`
        : project.castingCalls.length > 1
            ? `/casting`
            : undefined

    // JSON-LD structured data
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': project.projectType === 'series' ? 'TVSeries' : 'Movie',
        name: project.title,
        description: project.description,
        image: project.coverImage,
        genre: project.genre,
        datePublished: project.year,
        url: `${siteUrl}/works/${project.slug}`,
        ...(project.projectType === 'series' ? {
            numberOfEpisodes: project.episodes.length,
        } : {}),
    }

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <ProjectDetailClient
                project={serializedProject}
                hasTrailer={hasTrailer}
            />
            {serializedProject.cast.length > 0 && (
                <CastShowcase
                    cast={serializedProject.cast}
                    castingHref={castingHref}
                    projectTitle={project.title}
                />
            )}
            <Footer />
        </>
    )
}
