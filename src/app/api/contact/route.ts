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

        // Resolve session once — used for both identity enforcement and notification mirroring
        const session = await getSessionAndRefresh()

        // Fix #3: If authenticated, resolve verified identity from session + DB.
        // TokenPayload carries email; name requires a DB lookup.
        // This prevents client spoofing by ignoring submitted name/email for logged-in users.
        let resolvedName = name
        let resolvedEmail = email
        if (session?.userId) {
            const dbUser = await prisma.user.findUnique({
                where: { id: session.userId as string },
                select: { name: true, email: true },
            })
            if (dbUser) {
                resolvedName = dbUser.name || name
                resolvedEmail = dbUser.email || email
            }
        }

        await prisma.contactMessage.create({
            data: { name: resolvedName, email: resolvedEmail, subject, message },
        })

        const lang = locale || 'en'

        // Localized email subject from i18n map (falls back to English)
        const localizedSubject = (emailT('contactAcknowledgment', lang, 'subject') || 'We received your message: {subject}').replace('{subject}', subject)

        // Fire-and-forget: auto-reply to sender
        sendEmail({
            to: resolvedEmail,
            subject: localizedSubject,
            html: await contactAcknowledgmentWithOverrides(resolvedName, subject, undefined, lang),
        })

        // Localized notification board strings
        const notifTitle = emailT('contactAcknowledgment', lang, 'heading') || 'Message Received \u2713'
        const notifBody = (emailT('contactAcknowledgment', lang, 'bodyIntro') || 'Your message regarding "{subject}" has been received. Our team will review it and get back to you as soon as possible.').replace(/{subject}/g, subject)

        // Mirror to notification board — only if the sender has a registered account
        if (session?.userId) {
            void mirrorToNotificationBoard(
                session.userId,
                'system',
                notifTitle,
                notifBody,
                '/contact',
                `contact-${session.userId}-${Date.now()}`,
            ).catch(() => { /* non-critical */ })
        }

        // Fire-and-forget: notify admin
        const settings = await prisma.siteSettings.findFirst({
            select: { notifyEmail: true, contactEmail: true },
        })
        const adminEmail = settings?.notifyEmail || settings?.contactEmail
        if (adminEmail) {
            sendEmail({
                to: adminEmail,
                subject: `\uD83D\uDCEC New Contact: ${subject}`,
                html: contactAdminNotification(resolvedName, resolvedEmail, subject, message),
                replyTo: resolvedEmail,
            })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Contact form error:', error)
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }
}
