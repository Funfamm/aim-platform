import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Public endpoint: fetch active sponsors by display location
// ?location=footer   → returns sponsors with displayOn = 'footer' | 'all'
// ?location=homepage → returns sponsors with displayOn = 'homepage' | 'all'
// ?locale=es         → returns description in the requested locale (falls back to default)
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const location = searchParams.get('location')
    const locale = searchParams.get('locale') || 'en'

    // Build displayOn filter based on location
    let displayOnFilter: object = {}
    if (location === 'footer') {
        displayOnFilter = { displayOn: { in: ['footer', 'all'] } }
    } else if (location === 'homepage') {
        displayOnFilter = { displayOn: { in: ['homepage', 'all'] } }
    } else if (location === 'sponsors') {
        displayOnFilter = { displayOn: { in: ['sponsors', 'all'] } }
    }

    const sponsors = await prisma.sponsor.findMany({
        where: {
            active: true,
            ...displayOnFilter,
        },
        orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
        select: {
            id: true, name: true, logoUrl: true, bannerUrl: true,
            website: true, tier: true, description: true,
            descriptionI18n: true,
            bannerDurationHours: true, displayOn: true,
        },
    })

    // Resolve localized description: prefer descriptionI18n[locale], fall back to default description
    const localized = sponsors.map(s => {
        const i18n = s.descriptionI18n as Record<string, string> | null
        const localizedDesc = i18n?.[locale] || i18n?.['en'] || s.description || null
        return {
            id: s.id, name: s.name, logoUrl: s.logoUrl, bannerUrl: s.bannerUrl,
            website: s.website, tier: s.tier, description: localizedDesc,
            bannerDurationHours: s.bannerDurationHours, displayOn: s.displayOn,
        }
    })

    return NextResponse.json(localized)
}
