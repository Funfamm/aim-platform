import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
    try {
        const settings = await prisma.siteSettings.findFirst()
        const s = settings as Record<string, string> | null

        return NextResponse.json({
            google: !!(s?.googleClientId),
            apple: !!(s?.appleClientId),
        })
    } catch {
        // Return defaults if settings can't be loaded
        return NextResponse.json({ google: false, apple: false })
    }
}

