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
    const projects = await prisma.project.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { episodes: true } } },
    })

    // ---- NEW: sanitize BigInt fields ----
    const projectsWithCounts = projects.map(p => ({
        ...sanitizeBigInt(p),
        episodeCount: p._count.episodes,
    }))
    // ------------------------------------

    const completedCount = projectsWithCounts.filter(p => p.status === 'completed').length
    const inProdCount = projectsWithCounts.filter(p => p.status === 'in-production').length

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

