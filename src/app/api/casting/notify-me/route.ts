import { NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendTransactionalEmail } from '@/lib/email-router'
import { subscribeConfirmationWithOverrides } from '@/lib/email-templates'
import { t as et } from '@/lib/email-i18n'
import crypto from 'crypto'

/**
 * POST /api/casting/notify-me
 * Subscribes the logged-in user to be notified when casting calls open.
 * Uses their account email — no email input needed. Idempotent.
 */
export async function POST(req: Request) {
    const session = await getUserSession()
    if (!session?.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let browsingLocale = 'en'
    try {
        const body = await req.json()
        if (typeof body?.browsingLocale === 'string') browsingLocale = body.browsingLocale
    } catch { /* body may be empty */ }

    const user = await prisma.user.findUnique({
        where: { id: session.userId as string },
        select: { email: true, name: true, preferredLanguage: true, receiveLocalizedEmails: true },
    })

    if (!user?.email) {
        return NextResponse.json({ error: 'User email not found' }, { status: 400 })
    }

    // Priority: 1) saved preferredLanguage, 2) browsing locale, 3) English
    const locale = (user.receiveLocalizedEmails !== false && user.preferredLanguage)
        ? user.preferredLanguage
        : (browsingLocale || 'en')
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''

    // ── Strict suppression check: do not reactivate suppressed/unsubscribed emails ──
    const existing = await prisma.subscriber.findUnique({
        where: { email: user.email },
        select: { active: true },
    }).catch(() => null)

    const isNew = !existing

    const suppression = await prisma.emailSuppression.findFirst({
        where: {
            email: user.email.toLowerCase(),
            removedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
    })
    const isSuppressed = !!suppression

    if (isSuppressed) {
        console.info(`[casting/notify-me] SUPPRESSED — ${user.email} has active suppression (reason=${suppression!.reason}), not reactivating`)
    }

    await prisma.subscriber.upsert({
        where: { email: user.email },
        update: isSuppressed ? {} : { active: true },
        create: { email: user.email, name: user.name || null, source: 'casting_notify', active: !isSuppressed },
    }).catch(() => null)

    // Send confirmation email only for new, non-suppressed subscribers
    if (isNew && !isSuppressed) {
        sendTransactionalEmail({
            to: user.email,
            subject: et('subscribe', locale, 'subject'),
            html: await subscribeConfirmationWithOverrides(user.name || undefined, siteUrl, locale),
        }).catch(err => console.error('[casting/notify-me] email failed:', err))
    }

    // ── NotificationSignup dual-write (admin visibility) ─────────────────────
    if (!isSuppressed) {
        const email = user.email.trim().toLowerCase()
        void prisma.notificationSignup.upsert({
            where:  { email_signupTag: { email, signupTag: 'casting_general' } },
            create: {
                email,
                signupTag:          'casting_general',
                notificationType:   'casting',
                requestedBy:        'member',
                requestSource:      'page_cta',
                sourceType:         'casting',
                sourcePageUrl:      req.headers.get('referer') || null,
                language:           locale,
                userId:             session.userId as string,
                status:             'active',
                confirmationSentAt: isNew ? new Date() : null,
                unsubscribeToken:   crypto.randomBytes(32).toString('hex'),
            },
            update: {},
        }).catch(err => console.error('[casting/notify-me] NotificationSignup upsert failed:', err.message))
    }

    return NextResponse.json({ subscribed: true, alreadySubscribed: !isNew })
}
