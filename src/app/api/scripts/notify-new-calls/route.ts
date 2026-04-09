import { NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/mailer'
import { subscribeConfirmationWithOverrides } from '@/lib/email-templates'
import { t as et } from '@/lib/email-i18n'

/**
 * POST /api/scripts/notify-new-calls
 * Subscribes the logged-in user to be notified when new script calls open.
 * Uses their account email — no email input needed from the frontend.
 * Idempotent — safe to call multiple times.
 */
export async function POST() {
    const session = await getUserSession()
    if (!session?.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's email + name + locale from their account
    const user = await prisma.user.findUnique({
        where: { id: session.userId as string },
        select: { email: true, name: true, preferredLanguage: true, receiveLocalizedEmails: true },
    })

    if (!user?.email) {
        return NextResponse.json({ error: 'User email not found' }, { status: 400 })
    }

    const locale = (user.receiveLocalizedEmails !== false && user.preferredLanguage)
        ? user.preferredLanguage
        : 'en'
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''

    const existingSubscriber = await prisma.subscriber.findUnique({
        where: { email: user.email },
        select: { active: true },
    }).catch(() => null)

    const isNew = !existingSubscriber

    // Upsert into newsletter subscriber list (idempotent)
    await prisma.subscriber.upsert({
        where: { email: user.email },
        update: { active: true },
        create: { email: user.email, name: user.name || null },
    }).catch(() => null)

    // Only send confirmation email if this is their first time subscribing
    if (isNew) {
        sendEmail({
            to: user.email,
            subject: et('subscribe', locale, 'subject'),
            html: await subscribeConfirmationWithOverrides(user.name || undefined, siteUrl, locale),
        }).catch(err => console.error('[notify-new-calls] email failed:', err))
    }

    return NextResponse.json({ subscribed: true })
}
