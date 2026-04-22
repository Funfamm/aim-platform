import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { prisma } from '@/lib/db'

// Rate limiter: 60 req/min per IP — shared across all project list calls
const limiter = rateLimit({ interval: 60_000, limit: 60 })

// Minimal projection — exactly what a movie card needs, nothing more
const CARD_SELECT = {
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
    _count: { select: { episodes: true } },
} as const

export async function GET(req: Request) {
    const blocked = limiter.check(req)
    if (blocked) return blocked

    const { searchParams } = new URL(req.url)

    // Parse filters
    const featured  = searchParams.get('featured') === 'true'
    const sort      = searchParams.get('sort') || 'sortOrder'   // newest | trending | sortOrder
    const genre     = searchParams.get('genre') || undefined
    const status    = searchParams.get('status') || undefined
    const cursor    = searchParams.get('cursor') || undefined

    // Clamp page size: default 12, max 20 — protects DB regardless of client input
    const limit = Math.min(parseInt(searchParams.get('limit') || '12', 10), 20)

    // Build where clause — always enforce published gate
    const where: Record<string, unknown> = { published: true }
    if (featured)          where.featured = true
    if (genre)             where.genre = { equals: genre, mode: 'insensitive' }
    if (status)            where.status = status

    // Build orderBy
    let orderBy: Record<string, string>[]
    if (sort === 'newest')   orderBy = [{ createdAt: 'desc' }]
    else if (sort === 'trending') orderBy = [{ viewCount: 'desc' }, { createdAt: 'desc' }]
    else                     orderBy = [{ sortOrder: 'asc' }, { createdAt: 'desc' }]

    const rows = await prisma.project.findMany({
        where,
        orderBy,
        take: limit + 1,
        select: CARD_SELECT,
        cursor: cursor ? { id: cursor } : undefined,
        skip:   cursor ? 1 : 0,
    })

    const hasMore   = rows.length > limit
    const items     = hasMore ? rows.slice(0, -1) : rows
    const nextCursor = hasMore ? items[items.length - 1].id : null

    const projects = items.map(p => ({
        ...p,
        episodeCount: p._count.episodes,
        _count: undefined,
    }))

    return NextResponse.json({ projects, nextCursor }, {
        headers: {
            // Cached 60s on CDN, served stale for up to 5 min while revalidating
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
    })
}
