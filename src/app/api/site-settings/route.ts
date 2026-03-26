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
                requireLoginForDonate: true,
                requireLoginForCasting: true,
                requireLoginForSponsors: true,
                allowPublicProjectPages: true,
                requireLoginForFilms: true,
                allowPublicTrailers: true,
            },
        })

        return NextResponse.json(settings || {
            siteName: 'AIM Studio',
            tagline: 'AI-Powered Filmmaking',
        })
    } catch {
        return NextResponse.json({ siteName: 'AIM Studio', tagline: 'AI-Powered Filmmaking' })
    }
}
