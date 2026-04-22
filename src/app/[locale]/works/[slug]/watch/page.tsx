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

    // Block watch access to unpublished projects (Watch Party has its own route)
    if (!project.published) notFound()

    // Record watch history — upsert on the most recent existing row so we
    // never overwrite completePct (resume position) with a blank new record.
    try {
        const existing = await prisma.watchHistory.findFirst({
            where: { userId: session.userId, projectId: project.id },
            orderBy: { watchedAt: 'desc' },
            select: { id: true },
        })
        if (existing) {
            // Touch the timestamp so it surfaces in "recently watched" lists
            await prisma.watchHistory.update({
                where: { id: existing.id },
                data: { watchedAt: new Date() },
            })
        } else {
            await prisma.watchHistory.create({
                data: { userId: session.userId, projectId: project.id },
            })
        }
    } catch { /* ignore errors */ }

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

    // Direct to specific apply page when one call, or listing when multiple
    const castingHref = project.castingCalls.length === 1
        ? `/casting/${project.castingCalls[0].id}/apply`
        : project.castingCalls.length > 1
            ? `/casting`
            : undefined

    const userPreferredLang = typeof session.preferredLanguage === 'string' ? session.preferredLanguage : 'en'

    return (
        <>
            <WatchPlayer project={serializedProject} userPreferredLang={userPreferredLang} />
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
