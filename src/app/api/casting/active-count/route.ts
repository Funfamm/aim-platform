import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/casting/active-count
 *
 * Returns the number of currently published (open) casting calls.
 * Lightweight endpoint used by the dashboard to decide whether
 * to show the "Explore Casting" link.
 */
export async function GET() {
    try {
        const count = await prisma.castingCall.count({
            where: { status: 'open' },
        })
        return NextResponse.json({ count })
    } catch {
        return NextResponse.json({ count: 0 })
    }
}
