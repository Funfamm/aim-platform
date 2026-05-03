import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendTransactionalEmail } from '@/lib/email-router'
import { subscribeWelcomeBackWithOverrides, subscribeWelcomeWithOverrides } from '@/lib/email-templates'
import { t as et } from '@/lib/email-i18n'
import { suppressEmail } from '@/lib/suppression'

// ── Bot Detection (same signals as admin subscriber panel) ─────────────────
const BOT_DISPOSABLE_DOMAINS = new Set([
    'emailax.pro', 'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com',
    'yopmail.com', 'trashmail.com', 'fakeinbox.com', 'sharklasers.com', 'dispostable.com',
    'mailnesia.com', 'tempail.com', 'temp-mail.org', 'mohmal.com', 'emailondeck.com',
    'getnada.com', '10minutemail.com', 'minutemail.com', 'maildrop.cc', 'mailcatch.com',
    'discard.email', 'tempr.email', 'temp-mail.io', 'guerrillamailblock.com', 'grr.la',
])
const BOT_SUSPECT_COUNTRIES = new Set(['RU', 'CN', 'VN', 'BD', 'PK', 'IN', 'BR', 'ID', 'NG'])

function calcSubscribeBotScore(email: string, name: string | null, country: string | null, recentCountryCount: number): number {
    let score = 0
    if (!name) score += 20
    const domain = email.split('@')[1]?.toLowerCase()
    if (domain && BOT_DISPOSABLE_DOMAINS.has(domain)) score += 30
    if (country && BOT_SUSPECT_COUNTRIES.has(country)) score += 25
    if (recentCountryCount >= 10) score += 25
    else if (recentCountryCount >= 5) score += 15
    return Math.min(score, 100)
}

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

        const { email, name, locale, website, turnstileToken } = await request.json()

        // Honeypot: bots fill this hidden field; humans never see it
        if (website) return NextResponse.json({ success: true })

        // ── Cloudflare Turnstile verification ─────────────────────────────────
        // Validate if token is present. If missing (widget didn't load), log warning
        // but allow — other protections (rate limit, honeypot, bot score) still apply.
        const turnstileSecret = process.env.TURNSTILE_SECRET_KEY
        if (turnstileSecret && turnstileToken) {
            try {
                const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        secret: turnstileSecret,
                        response: turnstileToken,
                        remoteip: ip,
                    }),
                })
                const verifyData = await verifyRes.json()
                if (!verifyData.success) {
                    console.warn('[subscribe] Turnstile verification failed:', verifyData)
                    return NextResponse.json({ error: 'Bot verification failed. Please try again.' }, { status: 403 })
                }
            } catch (err) {
                console.error('[subscribe] Turnstile verify error:', err)
                // Fail open — don't block if Cloudflare is down
            }
        } else if (turnstileSecret && !turnstileToken) {
            // No token — bot skipped the CAPTCHA widget entirely. Block it.
            console.warn(`[subscribe] BLOCKED — no Turnstile token from IP ${ip}`)
            return NextResponse.json({ error: 'Verification required. Please refresh and try again.' }, { status: 403 })
        }

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
        const country = request.headers.get('x-vercel-ip-country') || undefined

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
            // ── Suppression check: prevent re-subscribing addresses with permanent delivery issues ──
            const suppression = await prisma.emailSuppression.findFirst({
                where: {
                    email: normalizedEmail,
                    removedAt: null,
                    OR: [
                        { expiresAt: null },           // Permanent suppressions
                        { expiresAt: { gt: new Date() } }, // Not-yet-expired temp suppressions
                    ],
                },
            })

            if (suppression) {
                if (suppression.reason === 'hard_bounce' || suppression.reason === 'complaint') {
                    // Permanent delivery issues — block re-subscription
                    return NextResponse.json({
                        error: 'This email address has delivery issues. Please use a different email or contact support.',
                        blocked: true,
                    }, { status: 400 })
                }

                // Unsubscribe or soft_bounce — lift suppression
                // liftSuppression() handles BOTH suppression removal AND sets Subscriber.active = true
                const { liftSuppression } = await import('@/lib/suppression')
                await liftSuppression(normalizedEmail, 'system:resubscribe')
            }

            await db.subscriber.update({
                where: { email: normalizedEmail },
                data: { active: true, ...(name ? { name } : {}), ...(country ? { country } : {}), locale: userLocale, confirmToken: null },
            })
            sendTransactionalEmail({
                to: normalizedEmail,
                subject: et('subscribeWelcomeBack', userLocale, 'subject') || 'Welcome back to AIM Studio! 🎬',
                html: await subscribeWelcomeBackWithOverrides(name || undefined, siteUrl, userLocale),
                type: 'subscribe',
            }).catch(err => console.error('[subscribe] Welcome-back email failed:', err))
            return NextResponse.json({ success: true, welcomed: true })
        }

        // Case 3: New subscriber OR pending (never confirmed) — immediate confirmation + welcome email
        // ── Bot detection: compute score before writing subscriber ────────────
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
        const recentCountryCount = country ? await db.subscriber.count({
            where: { country, subscribedAt: { gte: oneHourAgo } },
        }) : 0
        const botScore = calcSubscribeBotScore(normalizedEmail, name || null, country || null, recentCountryCount)

        if (existing && !existing.confirmedAt) {
            // Pending confirmation — upgrade to active immediately
            await db.subscriber.update({
                where: { email: normalizedEmail },
                data: { active: true, confirmedAt: new Date(), confirmToken: null, locale: userLocale, botScore, ...(name ? { name } : {}) },
            })
        } else {
            // Brand new subscriber — create as active immediately (no double opt-in)
            await db.subscriber.create({
                data: { email: normalizedEmail, name: name || null, active: true, confirmedAt: new Date(), locale: userLocale, botScore, ...(country ? { country } : {}) },
            })
        }

        // ── Auto-suppress if high-risk bot ────────────────────────────────────
        if (botScore >= 70) {
            // Safety: never auto-suppress a registered user account
            const existingUser = await db.user.findFirst({ where: { email: normalizedEmail }, select: { id: true } })
            if (!existingUser) {
                // High-risk bot — suppress immediately and deactivate
                await suppressEmail(normalizedEmail, 'bot', `Auto-detected at subscribe: score ${botScore}`, 'subscribe')
                console.warn(`[subscribe] HIGH-RISK BOT suppressed: ${normalizedEmail} (score=${botScore}, country=${country})`)
                // Return success silently — don't reveal detection to the bot
                return NextResponse.json({ success: true, confirmed: true })
            }
        }

        sendTransactionalEmail({
            to: normalizedEmail,
            subject: et('subscribeWelcome', userLocale, 'subject') || 'Welcome to AIM Studio! 🎬',
            html: await subscribeWelcomeWithOverrides(name || undefined, siteUrl, userLocale),
            type: 'subscribe',
        }).catch(err => console.error('[subscribe] Welcome email failed:', err))

        return NextResponse.json({ success: true, confirmed: true })
    } catch (error) {
        console.error('Subscribe error:', error)
        return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
    }
}
