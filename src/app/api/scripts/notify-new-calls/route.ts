import { NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendTransactionalEmail } from '@/lib/email-router'
import { subscribeConfirmationWithOverrides } from '@/lib/email-templates'
import { t as et } from '@/lib/email-i18n'
import crypto from 'crypto'

/**
 * POST /api/scripts/notify-new-calls
 * Subscribes the logged-in user to be notified when new script calls open.
 * Uses their account email — no email input needed from the frontend.
 * Idempotent — safe to call multiple times.
 *
 * Aligned with /api/casting/notify-me pattern:
 * - Suppression check
 * - NotificationSignup dual-write
 * - Returns { subscribed: true, alreadySubscribed: boolean }
 */
export async function POST(req: Request) {
    const session = await getUserSession()
    if (!session?.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // browsingLocale: the locale of the page the user was on when they clicked Notify Me.
    // Used as second-priority fallback when no preferredLanguage is saved on the account.
    let browsingLocale = 'en'
    try {
        const body = await req.json()
        if (typeof body?.browsingLocale === 'string') browsingLocale = body.browsingLocale
    } catch { /* body may be empty */ }

    // Get user's email + name + locale from their account
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
        console.info(`[scripts/notify-new-calls] SUPPRESSED — ${user.email} has active suppression (reason=${suppression!.reason}), not reactivating`)
    }

    // Upsert into newsletter subscriber list — only set active if not suppressed
    await prisma.subscriber.upsert({
        where: { email: user.email },
        update: isSuppressed ? {} : { active: true },
        create: { email: user.email, name: user.name || null, source: 'scripts_notify', active: !isSuppressed },
    }).catch(() => null)

    // Only send confirmation email if this is their first time subscribing AND not suppressed
    if (isNew && !isSuppressed) {
        sendTransactionalEmail({
            to: user.email,
            subject: et('subscribe', locale, 'subject'),
            html: await subscribeConfirmationWithOverrides(user.name || undefined, siteUrl, locale),
        }).catch(err => console.error('[scripts/notify-new-calls] email failed:', err))
    }

    // ── NotificationSignup dual-write (admin visibility) ─────────────────────
    if (!isSuppressed) {
        const email = user.email.trim().toLowerCase()
        void prisma.notificationSignup.upsert({
            where: { email_signupTag: { email, signupTag: 'scripts_general' } },
            create: {
                email,
                signupTag:          'scripts_general',
                notificationType:   'scripts',
                requestedBy:        'member',
                requestSource:      'page_cta',
                sourceType:         'scripts',
                sourcePageUrl:      req.headers.get('referer') || null,
                language:           locale,
                userId:             session.userId as string,
                status:             'active',
                confirmationSentAt: isNew ? new Date() : null,
                unsubscribeToken:   crypto.randomBytes(32).toString('hex'),
            },
            update: {},
        }).catch(err => console.error('[scripts/notify-new-calls] NotificationSignup upsert failed:', err.message))
    }

    return NextResponse.json({ subscribed: true, alreadySubscribed: !isNew })
}
