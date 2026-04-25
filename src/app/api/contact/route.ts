import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendTransactionalEmail } from '@/lib/email-router'
import { contactAcknowledgmentWithOverrides, contactAdminNotification } from '@/lib/email-templates'
import { mirrorToNotificationBoard } from '@/lib/notifications'
import { getSessionAndRefresh } from '@/lib/auth'
import { t as emailT } from '@/lib/email-i18n'
import { rateLimit } from '@/lib/rate-limit'

// 5 contact submissions per IP per 5 minutes — stops form spam and email quota exhaustion
const contactLimiter = rateLimit({ interval: 5 * 60_000, limit: 5 })

export async function POST(request: Request) {
    // Rate limit — prevents form spam and Resend quota exhaustion
    const blocked = contactLimiter.check(request)
    if (blocked) return blocked

    try {
        const { name, email, subject, message, locale, _gotcha } = await request.json()

        // Honeypot — bots fill hidden fields; humans leave them empty.
        // Return a fake 200 to not reveal detection (deceptive rejection).
        if (_gotcha) return NextResponse.json({ success: true })

        // ── Server-side sanitization ────────────────────────────────────────
        // Enforce constraints here regardless of client-side validation.
        // This prevents oversized payloads from reaching the DB or email pipeline.
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        const safeEmail   = (email   as string || '').trim().toLowerCase().slice(0, 254)
        const safeName    = (name    as string || '').trim().slice(0, 200)
        const safeSubject = (subject as string || '').trim().slice(0, 500)
        const safeMessage = (message as string || '').trim().slice(0, 10_000)

        if (!safeName || !safeEmail || !safeSubject || !safeMessage) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
        }
        if (!emailRegex.test(safeEmail)) {
            return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
        }

        // Resolve session once — used for both identity enforcement and notification mirroring
        const session = await getSessionAndRefresh()

        // If authenticated, resolve verified identity from session + DB.
        // This prevents client spoofing — the DB identity overrides anything submitted.
        // For guests, the sanitized form values are used.
        let resolvedName  = safeName
        let resolvedEmail = safeEmail
        if (session?.userId) {
            const dbUser = await prisma.user.findUnique({
                where: { id: session.userId as string },
                select: { name: true, email: true },
            })
            if (dbUser) {
                resolvedName  = dbUser.name  || safeName
                resolvedEmail = dbUser.email || safeEmail
            }
        }

        await prisma.contactMessage.create({
            data: { name: resolvedName, email: resolvedEmail, subject: safeSubject, message: safeMessage },
        })

        const lang = locale || 'en'

        // Localized email subject from i18n map (falls back to English)
        const localizedSubject = (emailT('contactAcknowledgment', lang, 'subject') || 'We received your message: {subject}').replace('{subject}', safeSubject)

        // Fire-and-forget: auto-reply to sender
        sendTransactionalEmail({
            to: resolvedEmail,
            subject: localizedSubject,
            html: await contactAcknowledgmentWithOverrides(resolvedName, safeSubject, undefined, lang),
        })

        // Localized notification board strings
        const notifTitle = emailT('contactAcknowledgment', lang, 'heading') || 'Message Received \u2713'
        const notifBody = (emailT('contactAcknowledgment', lang, 'bodyIntro') || 'Your message regarding "{subject}" has been received. Our team will review it and get back to you as soon as possible.').replace(/{subject}/g, safeSubject)

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
            sendTransactionalEmail({
                to: adminEmail,
                subject: `\uD83D\uDCEC New Contact: ${safeSubject}`,
                html: contactAdminNotification(resolvedName, resolvedEmail, safeSubject, safeMessage),
                replyTo: resolvedEmail,
            })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Contact form error:', error)
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }
}
