import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { prisma } from '@/lib/db'

const limiter = rateLimit({ interval: 60_000, limit: 30 })

export async function GET(req: Request) {
    const blocked = limiter.check(req)
    if (blocked) return blocked

    const { searchParams } = new URL(req.url)
    const q      = searchParams.get('q')?.trim() ?? ''
    const locale = searchParams.get('locale') || 'en'
    const limit  = Math.min(parseInt(searchParams.get('limit') || '6', 10), 10)

    if (q.length < 2) {
        return NextResponse.json({ results: [] })
    }

    const results = await prisma.project.findMany({
        where: {
            published: true,
            OR: [
                { title:   { contains: q, mode: 'insensitive' } },
                { genre:   { contains: q, mode: 'insensitive' } },
                { tagline: { contains: q, mode: 'insensitive' } },
            ],
        },
        select: {
            id: true,
            title: true,
            slug: true,
            genre: true,
            status: true,
            year: true,
            coverImage: true,
            viewCount: true,
            translations: true,
        },
        orderBy: { viewCount: 'desc' }, // popular results first
        take: limit,
    })

    // Attach highlight info — which part of the title matched
    const enriched = results.map(r => {
        const idx = r.title.toLowerCase().indexOf(q.toLowerCase())
        return {
            ...r,
            highlight: idx !== -1
                ? { start: idx, end: idx + q.length }
                : null,
        }
    })

    return NextResponse.json({ results: enriched, locale }, {
        headers: { 'Cache-Control': 'no-store' }, // search results must be fresh
    })
}
