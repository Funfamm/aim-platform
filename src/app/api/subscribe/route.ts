import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendTransactionalEmail } from '@/lib/email-router'
import { subscribeWelcomeBackWithOverrides, subscribeWelcomeWithOverrides } from '@/lib/email-templates'
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

        const { email, name, locale, website } = await request.json()

        // Honeypot: bots fill this hidden field; humans never see it
        if (website) return NextResponse.json({ success: true })

        if (!email || typeof email !== 'string') {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 })
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email.trim())) {
            return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
        }

        // ── Auto-correct common domain typos ───────────────────────────────
        let correctedEmail = email.trim().toLowerCase().slice(0, 254)
        const typoMap: Record<string, string> = {
            'gmial.com': 'gmail.com', 'gmaill.com': 'gmail.com', 'gnail.com': 'gmail.com',
            'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmal.com': 'gmail.com',
            'gmail.con': 'gmail.com', 'gmail.co': 'gmail.com',
            'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.con': 'yahoo.com',
            'hotmal.com': 'hotmail.com', 'hotmial.com': 'hotmail.com', 'hotmail.con': 'hotmail.com',
            'outloo.com': 'outlook.com', 'outlok.com': 'outlook.com',
            'iclou.com': 'icloud.com', 'icloud.con': 'icloud.com',
        }
        const [localPart, domain] = correctedEmail.split('@')
        if (domain && typoMap[domain]) {
            correctedEmail = `${localPart}@${typoMap[domain]}`
        }

        // ── Block disposable / temporary email domains ─────────────────────
        const disposableDomains = new Set([
            'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com',
            'yopmail.com', 'trashmail.com', 'fakeinbox.com', 'sharklasers.com',
            'guerrillamailblock.com', 'grr.la', 'dispostable.com', 'mailnesia.com',
            'tempail.com', 'temp-mail.org', 'mohmal.com', 'emailondeck.com',
            'getnada.com', '10minutemail.com', 'minutemail.com', 'maildrop.cc',
            'mailcatch.com', 'discard.email', 'tempr.email', 'temp-mail.io',
        ])
        const emailDomain = correctedEmail.split('@')[1]
        if (emailDomain && disposableDomains.has(emailDomain)) {
            return NextResponse.json({ error: 'Please use a permanent email address' }, { status: 400 })
        }

        const normalizedEmail = correctedEmail
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
        const userLocale = locale || 'en'

        // ── Check existing subscription state ─────────────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any
        const existing = await db.subscriber.findUnique({
            where: { email: normalizedEmail },
            select: { active: true, confirmedAt: true },
        })

        // Case 1: Already actively subscribed — return early, no spam
        if (existing?.active === true) {
            return NextResponse.json({ success: true, alreadySubscribed: true })
        }

        // Case 2: Was previously unsubscribed (confirmed once, now inactive) — reactivate + welcome back
        // Returning subscribers skip double opt-in since they already confirmed once
        if (existing && existing.confirmedAt) {
            await db.subscriber.update({
                where: { email: normalizedEmail },
                data: { active: true, ...(name ? { name } : {}), confirmToken: null },
            })
            sendTransactionalEmail({
                to: normalizedEmail,
                subject: et('subscribeWelcomeBack', userLocale, 'subject') || 'Welcome back to AIM Studio! 🎬',
                html: await subscribeWelcomeBackWithOverrides(name || undefined, siteUrl, userLocale),
            }).catch(err => console.error('[subscribe] Welcome-back email failed:', err))
            return NextResponse.json({ success: true, welcomed: true })
        }

        // Case 3: New subscriber OR pending (never confirmed) — immediate confirmation + welcome email
        if (existing && !existing.confirmedAt) {
            // Pending confirmation — upgrade to active immediately
            await db.subscriber.update({
                where: { email: normalizedEmail },
                data: { active: true, confirmedAt: new Date(), confirmToken: null, ...(name ? { name } : {}) },
            })
        } else {
            // Brand new subscriber — create as active immediately (no double opt-in)
            await db.subscriber.create({
                data: { email: normalizedEmail, name: name || null, active: true, confirmedAt: new Date() },
            })
        }

        sendTransactionalEmail({
            to: normalizedEmail,
            subject: et('subscribeWelcome', userLocale, 'subject') || 'Welcome to AIM Studio! 🎬',
            html: await subscribeWelcomeWithOverrides(name || undefined, siteUrl, userLocale),
        }).catch(err => console.error('[subscribe] Welcome email failed:', err))

        return NextResponse.json({ success: true, confirmed: true })
    } catch (error) {
        console.error('Subscribe error:', error)
        return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
    }
}
