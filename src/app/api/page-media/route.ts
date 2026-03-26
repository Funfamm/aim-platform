import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Public endpoint: fetch active page media for a given page
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const page = searchParams.get('page')
    if (!page) return NextResponse.json([], { status: 200 })

    const items = await prisma.pageMedia.findMany({
        where: { page, active: true, type: { not: 'hero-video' } },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, url: true, type: true, title: true, sortOrder: true },
    })

    return NextResponse.json(items)
}
