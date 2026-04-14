import { redirect, notFound } from 'next/navigation'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Footer from '@/components/Footer'
import WatchPlayer from '@/components/WatchPlayer'
import CastShowcase from '@/components/CastShowcase'
import { getLocale } from 'next-intl/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const project = await prisma.project.findUnique({ where: { slug } })
    if (!project) return { title: 'Not Found' }
    return {
        title: `Watch ${project.title} | AIM Studio`,
        description: `Watch ${project.title}, exclusive member access on AIM Studio.`,
    }
}

export default async function WatchPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params

    // Auth gate — must be logged in
    const session = await getUserSession()
    if (!session?.userId) {
        const locale = await getLocale()
        redirect(`/${locale}/login?redirect=/works/${slug}/watch`)
    }

    // Fetch project
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
            episodes: {
                orderBy: [{ season: 'asc' }, { number: 'asc' }],
            },
            cast: {
                orderBy: { sortOrder: 'asc' },
            },
            castingCalls: {
                where: { status: 'open' },
                select: { id: true },
            },
        },
    })

    if (!project) notFound()

    // Record watch history
    try {
        await prisma.watchHistory.create({
            data: {
                userId: session.userId,
                projectId: project.id,
            },
        })
    } catch { /* ignore duplicates or errors */ }

    // If no film URL, redirect back to project page
    if (!project.filmUrl && project.episodes.length === 0) {
        redirect(`/works/${slug}`)
    }

    const serializedProject = {
        ...project,
        episodes: project.episodes.map(e => ({
            ...e,
            createdAt: e.createdAt.toISOString(),
        })),
    }

    const serializedCast = project.cast.map(m => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
    }))

    // Only show casting CTA when this project has open casting calls
    const castingHref = project.castingCalls.length > 0
        ? `/works/${slug}#casting`
        : undefined

    return (
        <>
            <WatchPlayer project={serializedProject} />
            {serializedCast.length > 0 && (
                <CastShowcase
                    cast={serializedCast}
                    castingHref={castingHref}
                    projectTitle={project.title}
                />
            )}
            <Footer />
        </>
    )
}
