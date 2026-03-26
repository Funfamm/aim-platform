import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/mailer'
import { contactAcknowledgmentWithOverrides, contactAdminNotification } from '@/lib/email-templates'

export async function POST(request: Request) {
    try {
        const { name, email, subject, message } = await request.json()

        if (!name || !email || !subject || !message) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
        }

        await prisma.contactMessage.create({
            data: { name, email, subject, message },
        })

        // Fire-and-forget: auto-reply to sender
        sendEmail({
            to: email,
            subject: `Message received: ${subject}`,
            html: await contactAcknowledgmentWithOverrides(name, subject),
        })

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
