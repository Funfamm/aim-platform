import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/mailer'
import { subscribeConfirmationWithOverrides, subscribeWelcomeBackWithOverrides } from '@/lib/email-templates'
import { t as et } from '@/lib/email-i18n'

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
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
        const userLocale = locale || 'en'

        // ── Check existing subscription state ─────────────────────────────────
        const existing = await prisma.subscriber.findUnique({
            where: { email: normalizedEmail },
            select: { active: true },
        })

        // Case 1: Already actively subscribed — return early, no email spam
        if (existing?.active === true) {
            return NextResponse.json({ success: true, alreadySubscribed: true })
        }

        // Case 2: Was previously unsubscribed (active: false) — reactivate + welcome back email
        if (existing && existing.active === false) {
            await prisma.subscriber.update({
                where: { email: normalizedEmail },
                data: { active: true, ...(name ? { name } : {}) },
            })
            sendEmail({
                to: normalizedEmail,
                subject: et('subscribeWelcomeBack', userLocale, 'subject') || 'Welcome back to AIM Studio! 🎬',
                html: await subscribeWelcomeBackWithOverrides(name || undefined, siteUrl, userLocale),
            }).catch(err => console.error('[subscribe] Welcome-back email failed:', err))
            return NextResponse.json({ success: true, welcomed: true })
        }

        // Case 3: Brand new subscriber — create + standard confirmation email
        await prisma.subscriber.create({
            data: { email: normalizedEmail, name: name || null },
        })
        sendEmail({
            to: normalizedEmail,
            subject: et('subscribe', userLocale, 'subject'),
            html: await subscribeConfirmationWithOverrides(name || undefined, siteUrl, userLocale),
        }).catch(err => console.error('[subscribe] Confirmation email failed:', err))

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Subscribe error:', error)
        return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
    }
}
