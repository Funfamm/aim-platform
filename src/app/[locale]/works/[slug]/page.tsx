import { notFound } from 'next/navigation'
import Footer from '@/components/Footer'
import ProjectDetailClient from '@/components/ProjectDetailClient2'
import CastShowcase from '@/components/CastShowcase'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { cache } from 'react'

export const revalidate = 60

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
    const project = await getProject(slug)

    if (!project) notFound()

    // Fetch session early — needed for both the admin preview bypass and trailer logic
    const session = await getUserSession()
    const isLoggedIn = !!session?.userId

    // Block direct access to unpublished projects — admins can preview
    if (!project.published) {
        const isAdmin = session?.role === 'admin' || session?.role === 'superadmin'
        if (!isAdmin) notFound()
    }

    // Enforce trailer access — trailers are locked behind login (same as films)
    let siteAllowTrailers = true
    try {
        const ss = await prisma.siteSettings.findFirst({ select: { allowPublicTrailers: true } })
        if (ss) siteAllowTrailers = ss.allowPublicTrailers
    } catch { /* schema drift safe */ }
    // Logged-in users always see trailers; logged-out users only if public trailers are allowed
    const showTrailer = siteAllowTrailers || isLoggedIn

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
                isLoggedIn={isLoggedIn}
                hasTrailer={hasTrailer}
                currentUserId={session?.userId || null}
                currentUserRole={session?.role || null}
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
