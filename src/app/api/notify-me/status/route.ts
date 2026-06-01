import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

// ── GET /api/notify-me/status?signupTag=... ──────────────────────────────────
// Authenticated endpoint: returns whether the logged-in user has already
// signed up for a specific Notify Me signupTag.
//
// ▸ Requires authenticated session — returns 401 for guests.
// ▸ Uses userId → user.email → NotificationSignup lookup.
// ▸ Response is Cache-Control: private, no-store — never publicly cached.
// ▸ Does NOT expose email or other user data.

export async function GET(req: NextRequest) {
    const session = await getUserSession()
    if (!session?.userId) {
        return NextResponse.json(
            { subscribed: false },
            {
                status: 401,
                headers: { 'Cache-Control': 'private, no-store' },
            }
        )
    }

    const signupTag = req.nextUrl.searchParams.get('signupTag')
    if (!signupTag) {
        return NextResponse.json(
            { error: 'Missing signupTag' },
            {
                status: 400,
                headers: { 'Cache-Control': 'private, no-store' },
            }
        )
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.userId as string },
            select: { email: true },
        })

        if (!user?.email) {
            return NextResponse.json(
                { subscribed: false },
                { headers: { 'Cache-Control': 'private, no-store' } }
            )
        }

        const email = user.email.trim().toLowerCase()

        const existing = await prisma.notificationSignup.findUnique({
            where: { email_signupTag: { email, signupTag } },
            select: { status: true },
        })

        const subscribed = existing?.status === 'active'

        return NextResponse.json(
            { subscribed },
            { headers: { 'Cache-Control': 'private, no-store' } }
        )
    } catch (err) {
        console.error('[notify-me/status] GET error:', err)
        return NextResponse.json(
            { subscribed: false },
            { headers: { 'Cache-Control': 'private, no-store' } }
        )
    }
}
