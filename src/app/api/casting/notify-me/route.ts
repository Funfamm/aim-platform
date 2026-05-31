import { NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendTransactionalEmail } from '@/lib/email-router'
import { subscribeConfirmationWithOverrides } from '@/lib/email-templates'
import { t as et } from '@/lib/email-i18n'

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

    const existing = await prisma.subscriber.findUnique({
        where: { email: user.email },
        select: { active: true },
    }).catch(() => null)

    const isNew = !existing

    await prisma.subscriber.upsert({
        where: { email: user.email },
        update: { active: true },
        create: { email: user.email, name: user.name || null, source: 'casting_notify' },
    }).catch(() => null)

    if (isNew) {
        sendTransactionalEmail({
            to: user.email,
            subject: et('subscribe', locale, 'subject'),
            html: await subscribeConfirmationWithOverrides(user.name || undefined, siteUrl, locale),
        }).catch(err => console.error('[casting/notify-me] email failed:', err))
    }

    return NextResponse.json({ subscribed: true, alreadySubscribed: !isNew })
}
