import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/movie-rolls?display=homepage|works|both
// Public endpoint — returns visible rolls with their projects for rendering on the frontend
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const display = searchParams.get('display') || 'both'

    const rolls = await prisma.movieRoll.findMany({
        where: {
            visible: true,
            displayOn: { in: display === 'both' ? ['both', 'homepage', 'works'] : [display, 'both'] },
        },
        orderBy: { sortOrder: 'asc' },
        include: {
            projects: {
                orderBy: { sortOrder: 'asc' },
                select: { projectId: true },
            },
        },
    })

    // Collect all unique project IDs
    const projectIds = [...new Set(rolls.flatMap(r => r.projects.map(p => p.projectId)))]

    if (projectIds.length === 0) {
        return NextResponse.json(rolls.map(r => ({ ...r, projectData: [] })))
    }

    // Fetch project data in one query
    const projects = await prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: {
            id: true,
            title: true,
            slug: true,
            tagline: true,
            genre: true,
            status: true,
            projectType: true,
            coverImage: true,
            trailerUrl: true,
            filmUrl: true,
            featured: true,
            viewCount: true,
            year: true,
            duration: true,
            translations: true,
            episodes: { select: { id: true } },
        },
    })

    const projectMap = new Map(projects.map(p => [p.id, { ...p, episodeCount: p.episodes.length }]))

    // Attach project data to each roll in order
    const result = rolls.map(roll => ({
        id: roll.id,
        title: roll.title,
        titleI18n: roll.titleI18n,
        icon: roll.icon,
        slug: roll.slug,
        projectData: roll.projects
            .map(rp => projectMap.get(rp.projectId))
            .filter(Boolean),
    }))

    return NextResponse.json(result, {
        headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' },
    })
}
