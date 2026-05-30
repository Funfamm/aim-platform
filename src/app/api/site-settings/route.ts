import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Public endpoint — returns only non-sensitive site settings (no API keys, no OAuth secrets)
export async function GET() {
    try {
        const settings = await prisma.siteSettings.findFirst({
            select: {
                siteName: true,
                tagline: true,
                logoUrl: true,
                aboutText: true,
                mission: true,
                contactEmail: true,
                contactPhone: true,
                address: true,
                socialLinks: true,
                donationsEnabled: true,
                donationMinAmount: true,
                scriptCallsEnabled: true,
                castingCallsEnabled: true,
                trainingEnabled: true,
                sponsorsPageEnabled: true,
                requireLoginForDonate: true,
                requireLoginForCasting: true,
                requireLoginForSponsors: true,
                allowPublicProjectPages: true,
                requireLoginForFilms: true,
                allowPublicTrailers: true,
            },
        })

        const res = NextResponse.json(settings || {
            siteName: 'AIM Studio',
            tagline: 'Creating Cinema with AI',
        })
        // Cache publicly — these settings change rarely and are fetched on every page load.
        // 60s fresh + 5min stale-while-revalidate. Admin panel clears localStorage + calls
        // refresh() after saving, so stale data never persists for admin users.
        res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
        return res
    } catch {
        return NextResponse.json({ siteName: 'AIM Studio', tagline: 'Creating Cinema with AI' })
    }
}
