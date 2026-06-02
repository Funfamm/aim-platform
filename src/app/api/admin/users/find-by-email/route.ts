import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any

export async function GET(request: NextRequest) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const email = (request.nextUrl.searchParams.get('email') || '').toLowerCase().trim()
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

    const [user, suppression, subscriber, notificationSignups, ctaTags] = await Promise.all([
        p.user.findUnique({
            where: { email },
            select: {
                id: true, name: true, email: true, role: true,
                loginMethod: true, googleId: true,
                preferredLanguage: true, createdAt: true,
            },
        }),
        p.emailSuppression.findUnique({
            where: { email },
            select: { reason: true, createdAt: true, removedAt: true },
        }),
        p.subscriber.findUnique({
            where: { email },
            select: { id: true, active: true, confirmedAt: true, suppressedAt: true, suppressReason: true, source: true },
        }),
        p.notificationSignup.findMany({
            where: { email },
            select: { id: true, signupTag: true, notificationType: true, sourceType: true, status: true, createdAt: true },
            orderBy: { createdAt: 'desc' as const },
        }),
        p.ctaConfiguration.findMany({
            where: { status: 'active' },
            select: { signupTag: true, notificationType: true },
            orderBy: { signupTag: 'asc' as const },
        }),
    ])

    const isSuppressed = !!(suppression && !suppression.removedAt)

    // Always return full context — UI can add non-users to subscriber/notification lists
    return NextResponse.json({
        found: !!user,
        user: user ?? null,
        isSuppressed,
        suppression: isSuppressed ? { reason: suppression.reason, createdAt: suppression.createdAt } : null,
        subscriber: subscriber ?? null,
        notificationSignups: notificationSignups ?? [],
        ctaTags: ctaTags ?? [],
    })
}
