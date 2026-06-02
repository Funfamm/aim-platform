import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any

export async function POST(request: NextRequest) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const body = await request.json()
    const email = ((body.email as string) || '').toLowerCase().trim()
    const listType: string = body.listType || ''
    const signupTag: string = ((body.signupTag as string) || '').trim()
    const sourceType: string = (body.sourceType as string) || 'general'
    const notificationType: string = (body.notificationType as string) || 'more'

    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })
    if (!['subscriber', 'notification'].includes(listType)) {
        return NextResponse.json({ error: 'listType must be subscriber or notification' }, { status: 400 })
    }
    if (listType === 'notification' && !signupTag) {
        return NextResponse.json({ error: 'signupTag required for notification' }, { status: 400 })
    }

    // User must already exist — never create one
    const user = await p.user.findUnique({
        where: { email },
        select: { id: true, name: true, preferredLanguage: true },
    })
    if (!user) {
        return NextResponse.json({ code: 'user_not_found', error: 'No user found with that email.' }, { status: 404 })
    }

    // Global suppression check — applies to both list types
    const suppression = await p.emailSuppression.findUnique({
        where: { email },
        select: { reason: true, removedAt: true },
    })
    if (suppression && !suppression.removedAt) {
        return NextResponse.json({
            code: 'suppressed',
            error: `Email is suppressed (${suppression.reason}). Cannot add to an active list without lifting suppression first.`,
        }, { status: 409 })
    }

    /* ── Subscriber (newsletter / general updates) ── */
    if (listType === 'subscriber') {
        const existing = await p.subscriber.findUnique({ where: { email } })

        if (existing) {
            // Bounced/suppressed at Subscriber level — do not touch
            if (existing.suppressedAt) {
                return NextResponse.json({
                    code: 'subscriber_suppressed',
                    error: 'A Subscriber record exists but is suppressed/bounced. Suppression has not been lifted.',
                }, { status: 409 })
            }
            // Already active
            if (existing.active) {
                return NextResponse.json({ code: 'already_subscribed', message: 'User is already an active subscriber.' })
            }
            // Inactive (unconfirmed or manually deactivated) — do not silently reactivate
            return NextResponse.json({
                code: 'inactive_subscriber',
                error: 'A Subscriber record exists but is inactive. Will not silently reactivate — use the subscriber management tools.',
            }, { status: 409 })
        }

        await p.subscriber.create({
            data: {
                email,
                name: user.name ?? null,
                source: 'admin_manual_add',
                locale: user.preferredLanguage || 'en',
                active: true,
                confirmedAt: new Date(),
            },
        })
        return NextResponse.json({ code: 'added', message: 'Successfully added to newsletter.' })
    }

    /* ── NotificationSignup (Notify Me / CTA source) ── */
    const existing = await p.notificationSignup.findUnique({
        where: { email_signupTag: { email, signupTag } },
    })
    if (existing) {
        return NextResponse.json({ code: 'already_on_list', message: `Already on list "${signupTag}".` })
    }

    const unsubscribeToken = crypto.randomBytes(32).toString('hex')
    await p.notificationSignup.create({
        data: {
            email,
            signupTag,
            notificationType,
            userId: user.id,
            language: user.preferredLanguage || 'en',
            requestedBy: 'member',
            requestSource: 'admin_manual_add',
            sourceType,
            status: 'active',
            unsubscribeToken,
        },
    })
    return NextResponse.json({ code: 'added', message: `Successfully added to "${signupTag}".` })
}
