import Footer from '@/components/Footer'
import { sanitizeBigInt } from '@/lib/serializer'
import WorksPageClient from '@/components/WorksPageClient'
import { prisma } from '@/lib/db'

export const revalidate = 120

export const metadata = {
    title: 'Our Works | AIM Studio',
    description: 'Explore the portfolio of AI-crafted films and visual narratives produced by AIM Studio.',
}

export default async function WorksPage() {
    // Fetch projects + distinct genres in parallel
    const [projects, genreRows] = await Promise.all([
        prisma.project.findMany({
            orderBy: { sortOrder: 'asc' },
            include: { _count: { select: { episodes: true } } },
        }),
        prisma.project.findMany({
            where:    { genre: { not: null } },
            select:   { genre: true },
            distinct: ['genre'],
            orderBy:  { viewCount: 'desc' },
            take: 12, // max 12 genre rows on mobile
        }),
    ])

    const projectsWithCounts = projects.map(p => ({
        ...sanitizeBigInt(p),
        episodeCount: p._count.episodes,
    }))

    const genres = genreRows
        .map(r => r.genre as string)
        .filter(Boolean)

    const completedCount = projectsWithCounts.filter(p => p.status === 'completed').length
    const inProdCount    = projectsWithCounts.filter(p => p.status === 'in-production').length

    return (
        <>
            <WorksPageClient
                projects={projectsWithCounts}
                completedCount={completedCount}
                inProdCount={inProdCount}
                genres={genres}
            />
            <Footer />
        </>
    )
}
