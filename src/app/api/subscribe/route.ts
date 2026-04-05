import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/mailer'
import { subscribeConfirmationWithOverrides } from '@/lib/email-templates'

export async function POST(request: Request) {
    try {
        const { email, name, locale } = await request.json()

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 })
        }

        // Upsert — silently handle duplicates
        await prisma.subscriber.upsert({
            where: { email },
            update: { active: true, name: name || undefined },
            create: { email, name: name || null },
        })

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''

        // Fire-and-forget confirmation email
        sendEmail({
            to: email,
            subject: "You're subscribed to AIM Studio! 🎬",
            html: await subscribeConfirmationWithOverrides(name || undefined, siteUrl, locale || 'en'),
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Subscribe error:', error)
        return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
    }
}
