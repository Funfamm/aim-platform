import Footer from '@/components/Footer'
import { sanitizeBigInt } from '@/lib/serializer'
import WorksPageClient from '@/components/WorksPageClient'
import { prisma } from '@/lib/db'

export const revalidate = 60

export const metadata = {
    title: 'Our Works | AIM Studio',
    description: 'Explore the portfolio of AI-crafted films and visual narratives produced by AIM Studio.',
}

export default async function WorksPage() {
    // Fetch projects + distinct genres + movie rolls in parallel
    const [projects, genreRows, rawRolls] = await Promise.all([
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
        prisma.movieRoll.findMany({
            where: {
                visible: true,
                displayOn: { in: ['works', 'both'] },
            },
            orderBy: { sortOrder: 'asc' },
            include: { projects: { orderBy: { sortOrder: 'asc' }, select: { projectId: true, sortOrder: true } } },
        }),
    ])

    const projectsWithCounts = projects.map(p => ({
        ...sanitizeBigInt(p),
        episodeCount: p._count.episodes,
    }))

    const genres = genreRows
        .map(r => r.genre as string)
        .filter(Boolean)

    // Normalize roll data — two-step: collect all project IDs, batch-fetch, then merge
    type RawRoll = Awaited<typeof rawRolls>[number]
    const allRollProjectIds = [...new Set(rawRolls.flatMap((r: RawRoll) => r.projects.map((p: { projectId: string }) => p.projectId)))] as string[]
    const rollProjectsFull = allRollProjectIds.length > 0
        ? await prisma.project.findMany({
            where: { id: { in: allRollProjectIds } },
            include: { _count: { select: { episodes: true } } },
          })
        : []
    const rollProjectMap = new Map(rollProjectsFull.map(p => [p.id, { ...sanitizeBigInt(p), episodeCount: p._count.episodes }]))

    const rolls = rawRolls
        .map((roll: RawRoll) => ({
            id:       roll.id,
            title:    roll.title,
            titleI18n: roll.titleI18n as string | null,
            icon:     roll.icon,
            slug:     roll.slug,
            projects: roll.projects
                .map((rp: { projectId: string }) => rollProjectMap.get(rp.projectId))
                .filter(Boolean),
        }))
        .filter((roll: { projects: unknown[] }) => roll.projects.length > 0)

    const completedCount = projectsWithCounts.filter(p => p.status === 'completed').length
    const inProdCount    = projectsWithCounts.filter(p => p.status === 'in-production').length

    return (
        <>
            <WorksPageClient
                projects={projectsWithCounts}
                completedCount={completedCount}
                inProdCount={inProdCount}
                genres={genres}
                rolls={rolls as Parameters<typeof WorksPageClient>[0]['rolls']}
            />
            <Footer />
        </>
    )
}
