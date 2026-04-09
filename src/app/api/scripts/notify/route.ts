import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * POST /api/scripts/notify
 * Body: { scriptCallId: string }
 * Subscribes the logged-in user to get notified when this script call opens.
 * Idempotent — re-subscribing is a no-op.
 *
 * DELETE /api/scripts/notify
 * Body: { scriptCallId: string }
 * Unsubscribes.
 *
 * GET /api/scripts/notify?scriptCallId=xxx
 * Returns { subscribed: boolean }
 */

export async function GET(request: NextRequest) {
    const session = await getUserSession()
    if (!session?.userId) return NextResponse.json({ subscribed: false }, { status: 401 })

    const scriptCallId = request.nextUrl.searchParams.get('scriptCallId')
    if (!scriptCallId) return NextResponse.json({ error: 'Missing scriptCallId' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (prisma as any).scriptCallNotify.findUnique({
        where: { scriptCallId_userId: { scriptCallId, userId: session.userId as string } },
        select: { id: true },
    }).catch(() => null)

    return NextResponse.json({ subscribed: !!existing })
}

export async function POST(request: NextRequest) {
    const session = await getUserSession()
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { scriptCallId } = await request.json()
    if (!scriptCallId) return NextResponse.json({ error: 'Missing scriptCallId' }, { status: 400 })

    // Upsert — idempotent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).scriptCallNotify.upsert({
        where: { scriptCallId_userId: { scriptCallId, userId: session.userId as string } },
        create: { scriptCallId, userId: session.userId as string },
        update: {}, // already subscribed, no-op
    })

    return NextResponse.json({ subscribed: true })
}

export async function DELETE(request: NextRequest) {
    const session = await getUserSession()
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { scriptCallId } = await request.json()
    if (!scriptCallId) return NextResponse.json({ error: 'Missing scriptCallId' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).scriptCallNotify.deleteMany({
        where: { scriptCallId, userId: session.userId as string },
    }).catch(() => null)

    return NextResponse.json({ subscribed: false })
}
