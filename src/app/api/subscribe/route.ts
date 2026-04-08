import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/mailer'
import { subscribeConfirmationWithOverrides } from '@/lib/email-templates'

// Simple in-memory rate limiter: max 3 subscribe attempts per IP per hour
const ipAttempts = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
    const now = Date.now()
    const windowMs = 60 * 60 * 1000 // 1 hour
    const attempts = (ipAttempts.get(ip) || []).filter(t => now - t < windowMs)
    if (attempts.length >= 3) return true
    attempts.push(now)
    ipAttempts.set(ip, attempts)
    return false
}

export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

        if (isRateLimited(ip)) {
            return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
        }

        const { email, name, locale } = await request.json()

        if (!email || typeof email !== 'string') {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 })
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email.trim())) {
            return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
        }

        const normalizedEmail = email.trim().toLowerCase().slice(0, 254)

        // Upsert — silently handle duplicates
        await prisma.subscriber.upsert({
            where: { email: normalizedEmail },
            update: { active: true, name: name || undefined },
            create: { email: normalizedEmail, name: name || null },
        })

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''

        // Fire-and-forget confirmation email
        sendEmail({
            to: normalizedEmail,
            subject: "You're subscribed to AIM Studio! 🎬",
            html: await subscribeConfirmationWithOverrides(name || undefined, siteUrl, locale || 'en'),
        }).catch(err => console.error('[subscribe] Confirmation email failed:', err))

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Subscribe error:', error)
        return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
    }
}
