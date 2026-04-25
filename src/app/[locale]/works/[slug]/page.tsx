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
    return {
        title: `${project.title} | AIM Studio`,
        description: project.tagline || project.description.slice(0, 160),
    }
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const project = await getProject(slug)

    if (!project) notFound()

    // Block direct access to unpublished projects
    if (!project.published) notFound()

    // Enforce trailer access control — strip trailerUrl for logged-out users when disabled
    const session = await getUserSession()
    const isLoggedIn = !!session?.userId
    let siteAllowTrailers = true
    let trailerGateConfig: { enabled: boolean; previewSeconds: number; message?: string | null } | undefined
    try {
        const ss = await prisma.siteSettings.findFirst({ select: { allowPublicTrailers: true, trailerPreviewEnabled: true, trailerPreviewSeconds: true, trailerPreviewMessage: true } })
        if (ss) {
            siteAllowTrailers = ss.allowPublicTrailers
            // Only pass gate config when user is NOT logged in and gate is enabled
            if (!isLoggedIn && ss.trailerPreviewEnabled) {
                trailerGateConfig = {
                    enabled: true,
                    previewSeconds: ss.trailerPreviewSeconds,
                    message: ss.trailerPreviewMessage,
                }
            }
        }
    } catch { /* schema drift safe */ }
    const showTrailer = siteAllowTrailers || isLoggedIn

    // Serialize dates for client component
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

    return (
        <>
            <ProjectDetailClient project={serializedProject} trailerGate={trailerGateConfig} />
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
