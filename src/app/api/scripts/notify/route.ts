import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

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

    const userId = session.userId as string

    // Run ScriptCallNotify upsert and user fetch in parallel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [, user] = await Promise.all([
        (prisma as any).scriptCallNotify.upsert({
            where:  { scriptCallId_userId: { scriptCallId, userId } },
            create: { scriptCallId, userId },
            update: {},
        }),
        prisma.user.findUnique({
            where:  { id: userId },
            select: { email: true, preferredLanguage: true },
        }),
    ])

    // ── NotificationSignup dual-write (admin visibility) ─────────────────────
    if (user?.email) {
        const email      = user.email.trim().toLowerCase()
        const signupTag  = `scripts_${scriptCallId}`
        const sourcePageUrl = request.headers.get('referer') || null
        void prisma.notificationSignup.upsert({
            where:  { email_signupTag: { email, signupTag } },
            create: {
                email,
                signupTag,
                notificationType: 'scripts',
                requestedBy:      'member',
                requestSource:    'page_cta',
                sourceType:       'scripts',
                sourceEntityId:   scriptCallId,
                sourcePageUrl,
                language:         user.preferredLanguage || 'en',
                userId,
                status:           'active',
                unsubscribeToken: crypto.randomBytes(32).toString('hex'),
            },
            update: {},
        }).catch(err => console.error('[scripts/notify] NotificationSignup upsert failed:', err.message))
    }

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
