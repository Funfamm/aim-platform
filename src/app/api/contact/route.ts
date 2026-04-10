import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/mailer'
import { contactAcknowledgmentWithOverrides, contactAdminNotification } from '@/lib/email-templates'
import { mirrorToNotificationBoard } from '@/lib/notifications'
import { getSessionAndRefresh } from '@/lib/auth'
import { t as emailT } from '@/lib/email-i18n'

export async function POST(request: Request) {
    try {
        const { name, email, subject, message, locale } = await request.json()

        if (!name || !email || !subject || !message) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
        }

        await prisma.contactMessage.create({
            data: { name, email, subject, message },
        })

        const lang = locale || 'en'

        // Localized email subject from i18n map (falls back to English)
        const localizedSubject = (emailT('contactAcknowledgment', lang, 'subject') || 'We received your message: {subject}').replace('{subject}', subject)

        // Fire-and-forget: auto-reply to sender + mirror to notification board if logged in
        sendEmail({
            to: email,
            subject: localizedSubject,
            html: await contactAcknowledgmentWithOverrides(name, subject, undefined, lang),
        })

        // Localized notification board strings
        const notifTitle = emailT('contactAcknowledgment', lang, 'heading') || 'Message Received ✓'
        const notifBody = (emailT('contactAcknowledgment', lang, 'bodyIntro') || 'Your message regarding "{subject}" has been received. Our team will review it and get back to you as soon as possible.').replace(/{subject}/g, subject)

        // Mirror to notification board — only if the sender has a registered account
        void (async () => {
            try {
                const session = await getSessionAndRefresh()
                if (session?.userId) {
                    await mirrorToNotificationBoard(
                        session.userId,
                        'system',
                        notifTitle,
                        notifBody,
                        '/contact',
                        `contact-${session.userId}-${Date.now()}`,
                    )
                }
            } catch { /* non-critical */ }
        })()

        // Fire-and-forget: notify admin
        const settings = await prisma.siteSettings.findFirst({
            select: { notifyEmail: true, contactEmail: true },
        })
        const adminEmail = settings?.notifyEmail || settings?.contactEmail
        if (adminEmail) {
            sendEmail({
                to: adminEmail,
                subject: `📬 New Contact: ${subject}`,
                html: contactAdminNotification(name, email, subject, message),
                replyTo: email,
            })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Contact form error:', error)
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }
}
