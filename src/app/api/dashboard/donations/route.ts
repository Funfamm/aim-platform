import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
    try {
        const session = await getUserSession()
        if (!session?.userId) {
            return NextResponse.json({ donations: [] })
        }

        const { searchParams } = new URL(request.url)
        const cursor = searchParams.get('cursor')
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

        const donations = await prisma.donation.findMany({
            where: { userId: session.userId },
            orderBy: { createdAt: 'desc' },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            select: {
                id: true,
                name: true,
                amount: true,
                message: true,
                anonymous: true,
                method: true,
                status: true,
                createdAt: true,
            },
        })

        const hasMore = donations.length > limit
        const items = hasMore ? donations.slice(0, limit) : donations
        const nextCursor = hasMore ? items[items.length - 1].id : null

        return NextResponse.json({
            donations: items,
            nextCursor,
            hasMore,
        })
    } catch (error) {
        console.error('Dashboard donations error:', error)
        return NextResponse.json({ donations: [] })
    }
}
