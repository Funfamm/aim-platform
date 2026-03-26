import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
    const session = await getUserSession()
    if (!session?.userId) {
        return NextResponse.json({ applications: [] }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    const user = await prisma.user.findUnique({
        where: { id: session.userId as string },
        select: { email: true },
    })

    if (!user) {
        return NextResponse.json({ applications: [] }, { status: 401 })
    }

    const applications = await prisma.application.findMany({
        where: {
            OR: [
                { userId: session.userId as string },
                { email: user.email },
            ],
        },
        include: {
            castingCall: {
                include: {
                    project: {
                        select: { title: true, slug: true },
                    },
                },
            },
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = applications.length > limit
    const items = hasMore ? applications.slice(0, limit) : applications
    const nextCursor = hasMore ? items[items.length - 1].id : null

    return NextResponse.json({
        applications: items,
        nextCursor,
        hasMore,
    })
}
