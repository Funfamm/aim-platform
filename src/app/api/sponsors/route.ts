import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Public endpoint: fetch active sponsors by display location
// ?location=footer  → returns sponsors with displayOn = 'footer' | 'all'
// ?location=homepage → returns sponsors with displayOn = 'homepage' | 'all'
// (no param)        → returns all active sponsors
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const location = searchParams.get('location')

    // Build displayOn filter based on location
    let displayOnFilter: object = {}
    if (location === 'footer') {
        displayOnFilter = { displayOn: { in: ['footer', 'all'] } }
    } else if (location === 'homepage') {
        displayOnFilter = { displayOn: { in: ['homepage', 'all'] } }
    } else if (location === 'sponsors') {
        displayOnFilter = { displayOn: { in: ['sponsors', 'all'] } }
    }
    // If no location, return all active sponsors

    const sponsors = await prisma.sponsor.findMany({
        where: {
            active: true,
            ...displayOnFilter,
        },
        orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
        select: {
            id: true, name: true, logoUrl: true, bannerUrl: true,
            website: true, tier: true, description: true,
            bannerDurationHours: true, displayOn: true,
        },
    })

    return NextResponse.json(sponsors)
}
