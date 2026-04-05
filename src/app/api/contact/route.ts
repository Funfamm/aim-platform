import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/mailer'
import { contactAcknowledgmentWithOverrides, contactAdminNotification } from '@/lib/email-templates'
import { mirrorToNotificationBoard } from '@/lib/notifications'
import { getSessionAndRefresh } from '@/lib/auth'

export async function POST(request: Request) {
    try {
        const { name, email, subject, message } = await request.json()

        if (!name || !email || !subject || !message) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
        }

        await prisma.contactMessage.create({
            data: { name, email, subject, message },
        })

        // Fire-and-forget: auto-reply to sender + mirror to notification board if logged in
        sendEmail({
            to: email,
            subject: `Message received: ${subject}`,
            html: await contactAcknowledgmentWithOverrides(name, subject),
        })

        // Mirror to notification board — only if the sender has a registered account
        void (async () => {
            try {
                const session = await getSessionAndRefresh()
                if (session?.userId) {
                    await mirrorToNotificationBoard(
                        session.userId,
                        'system',
                        `Message Received ✓`,
                        `Your message about "${subject}" has been received. We typically respond within 1-3 business days.`,
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
