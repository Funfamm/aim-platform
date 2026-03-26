import Link from 'next/link'
import { notFound } from 'next/navigation'
import Footer from '@/components/Footer'
import ProjectDetailClient from '@/components/ProjectDetailClient2'
import { prisma } from '@/lib/db'
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

    // Serialize dates for client component
    const serializedProject = {
        ...project,
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
    }

    return (
        <>
<ProjectDetailClient project={serializedProject} />
            <Footer />
        </>
    )
}
