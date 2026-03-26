import Footer from '@/components/Footer'
import WorksPageClient from '@/components/WorksPageClient'
import { prisma } from '@/lib/db'

export const revalidate = 120

export const metadata = {
    title: 'Our Works | AIM Studio',
    description: 'Explore the portfolio of AI-crafted films and visual narratives produced by AIM Studio.',
}

export default async function WorksPage() {
    const projects = await prisma.project.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { episodes: true } } },
    })

    const completedCount = projects.filter(p => p.status === 'completed').length
    const inProdCount = projects.filter(p => p.status === 'in-production').length

    // Flatten the _count into the project objects for the client
    const projectsWithCounts = projects.map(p => ({
        ...p,
        episodeCount: p._count.episodes,
    }))

    return (
        <>
<WorksPageClient
                projects={projectsWithCounts}
                completedCount={completedCount}
                inProdCount={inProdCount}
            />
            <Footer />
        </>
    )
}

