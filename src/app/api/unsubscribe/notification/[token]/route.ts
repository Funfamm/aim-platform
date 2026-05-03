import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// ── GET /api/unsubscribe/notification/[token] ───────────────────────────────
// Returns the unsubscribe page data (signup info for confirmation UI).
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params

    const signup = await prisma.notificationSignup.findUnique({
        where: { unsubscribeToken: token },
        select: { email: true, signupTag: true, notificationType: true },
    })

    if (!signup) {
        return NextResponse.json({ error: 'Invalid or expired unsubscribe link.' }, { status: 404 })
    }

    // Count how many other notification signups this email has
    const otherCount = await prisma.notificationSignup.count({
        where: { email: signup.email, unsubscribeToken: { not: token } },
    })

    return NextResponse.json({
        email: signup.email,
        signupTag: signup.signupTag,
        notificationType: signup.notificationType,
        otherSubscriptionCount: otherCount,
    })
}

// ── POST /api/unsubscribe/notification/[token] ──────────────────────────────
// Handles unsubscribe actions: granular (this tag only) or global (all tags).
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params

    const signup = await prisma.notificationSignup.findUnique({
        where: { unsubscribeToken: token },
    })

    if (!signup) {
        return NextResponse.json({ error: 'Invalid or expired unsubscribe link.' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const scope = body.scope || 'tag' // 'tag' = just this notification, 'all' = all notifications

    if (scope === 'all') {
        // Delete ALL notification signups for this email
        const result = await prisma.notificationSignup.deleteMany({
            where: { email: signup.email },
        })
        return NextResponse.json({
            success: true,
            message: `Unsubscribed from all notifications (${result.count} removed).`,
        })
    }

    // Granular: delete only this specific signup
    await prisma.notificationSignup.delete({
        where: { unsubscribeToken: token },
    })

    return NextResponse.json({
        success: true,
        message: `Unsubscribed from ${signup.signupTag} notifications.`,
    })
}
