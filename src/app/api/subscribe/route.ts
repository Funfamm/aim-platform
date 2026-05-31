import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendTransactionalEmail } from '@/lib/email-router'
import { sendEmail } from '@/lib/mailer'
import { subscribeWelcomeBackWithOverrides } from '@/lib/email-templates'
import { subscribeConfirmation } from '@/lib/email-templates'
import { t as et } from '@/lib/email-i18n'
import { suppressEmail } from '@/lib/suppression'
import crypto from 'crypto'

// ── Bot Detection — unified scoring from shared module ──────────────────────
import { calcBotScore } from '@/lib/botScore'

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

// ── Housekeeping: purge stale IP entries every 30 min to prevent memory growth ──
setInterval(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000 // older than 24 hours
    for (const [ip, timestamps] of ipAttempts.entries()) {
        const fresh = timestamps.filter(t => t > cutoff)
        if (fresh.length === 0) ipAttempts.delete(ip)
        else ipAttempts.set(ip, fresh)
    }
}, 30 * 60 * 1000)

// ── Fetch subscriber mode from SiteSettings (cached per-request) ───────────
async function getSubscriberMode(): Promise<'manual_approval' | 'double_opt_in'> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const settings = await (prisma.siteSettings as any).findFirst({
            select: { subscriberMode: true },
        })
        return (settings?.subscriberMode === 'double_opt_in') ? 'double_opt_in' : 'manual_approval'
    } catch {
        return 'manual_approval' // safe default
    }
}

export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

        if (isRateLimited(ip)) {
            return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
        }

        const { email, name, locale, website, loadedAt, turnstileToken } = await request.json()

        // ── Time-delay check: bots submit in <500ms; real users take ≥2s ──────
        if (typeof loadedAt === 'number' && Date.now() - loadedAt < 2000) {
            console.warn(`[subscribe] BLOCKED — too fast (${Date.now() - loadedAt}ms) from IP ${ip}`)
            return NextResponse.json({ success: true }) // silent fake success
        }

        // Honeypot: bots fill this hidden field; humans never see it
        if (website) return NextResponse.json({ success: true })

        // ── Cloudflare Turnstile verification (mandatory — fail-closed) ───────────
        // When TURNSTILE_SECRET_KEY is not set, subscriptions are blocked entirely.
        // This prevents bots from subscribing while Turnstile is being configured.
        // To enable subscriptions, add NEXT_PUBLIC_TURNSTILE_SITE_KEY and
        // TURNSTILE_SECRET_KEY to your Vercel environment variables.
        const turnstileSecret = process.env.TURNSTILE_SECRET_KEY
        if (!turnstileSecret) {
            console.error('[subscribe] BLOCKED — TURNSTILE_SECRET_KEY not configured. Add Cloudflare Turnstile env vars to enable subscriptions.')
            return NextResponse.json({ error: 'Verification is temporarily unavailable. Please try again later.' }, { status: 503 })
        }
        if (!turnstileToken) {
            console.warn(`[subscribe] BLOCKED — no Turnstile token from IP ${ip}`)
            return NextResponse.json({ error: 'Verification required. Please refresh and try again.' }, { status: 403 })
        }
        try {
            const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ secret: turnstileSecret, response: turnstileToken, remoteip: ip }),
            })
            const verifyData = await verifyRes.json() as { success: boolean }
            if (!verifyData.success) {
                console.warn(`[subscribe] BLOCKED — Turnstile verification failed from IP ${ip}`)
                return NextResponse.json({ error: 'Bot verification failed. Please try again.' }, { status: 403 })
            }
        } catch (err) {
            // Cloudflare API is unreachable — fail open only when Cloudflare itself is down
            console.error('[subscribe] Turnstile verify error (Cloudflare unreachable, fail-open):', err)
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

        // ── Determine subscribe mode ───────────────────────────────────────
        const subscriberMode = await getSubscriberMode()

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

        // Case 2: Was previously approved/confirmed, now inactive — reactivate
        if (existing && existing.confirmedAt) {
            // ── Suppression check: prevent re-subscribing addresses with permanent delivery issues ──
            const suppression = await prisma.emailSuppression.findFirst({
                where: {
                    email: normalizedEmail,
                    removedAt: null,
                    OR: [
                        { expiresAt: null },
                        { expiresAt: { gt: new Date() } },
                    ],
                },
            })

            if (suppression) {
                if (suppression.reason === 'hard_bounce' || suppression.reason === 'complaint') {
                    return NextResponse.json({
                        error: 'This email address has delivery issues. Please use a different email or contact support.',
                        blocked: true,
                    }, { status: 400 })
                }
                const { liftSuppression } = await import('@/lib/suppression')
                await liftSuppression(normalizedEmail, 'system:resubscribe')
            }

            await db.subscriber.update({
                where: { email: normalizedEmail },
                data: { active: true, ...(name ? { name } : {}), ...(country ? { country } : {}), locale: userLocale, confirmToken: null },
            })

            // Only send welcome-back email in double_opt_in mode
            if (subscriberMode === 'double_opt_in') {
                sendTransactionalEmail({
                    to: normalizedEmail,
                    subject: et('subscribeWelcomeBack', userLocale, 'subject') || 'Welcome back to AIM Studio! 🎬',
                    html: await subscribeWelcomeBackWithOverrides(name || undefined, siteUrl, userLocale),
                    type: 'subscribe',
                }).catch(err => console.error('[subscribe] Welcome-back email failed:', err))
            }

            return NextResponse.json({ success: true, welcomed: true })
        }

        // ── Bot detection: compute score before writing subscriber ────────────
        // Runs in ALL modes — feeds botScore for admin Bot Cleanup review
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
        const recentCountryCount = country ? await db.subscriber.count({
            where: { country, subscribedAt: { gte: oneHourAgo } },
        }) : 0
        const { score: botScore, breakdown } = calcBotScore(
            { email: normalizedEmail, name: name || null, country: country || null },
            false, // new subscriber — has never opened an email yet
            recentCountryCount,
        )

        const breakdownStr = Object.entries(breakdown).map(([k, v]) => `${k}=${v}`).join(', ')

        if (subscriberMode === 'manual_approval') {
            // ── MANUAL APPROVAL MODE ─────────────────────────────────────────
            // Silent capture: write subscriber with active: false, NO token, NO email.
            // Bot scoring is recorded for admin review — but we do NOT auto-suppress.
            // Admin uses Bot Cleanup to review and delete suspects.
            // High-score bots still land in the DB so admin can see the full picture.

            if (existing && !existing.confirmedAt) {
                // Pending (previously created) — refresh bot score + name/country
                await db.subscriber.update({
                    where: { email: normalizedEmail },
                    data: {
                        locale: userLocale,
                        botScore,
                        ...(name ? { name } : {}),
                        ...(country ? { country } : {}),
                    },
                })
            } else {
                // Brand new subscriber — create as inactive, awaiting manual approval
                await db.subscriber.create({
                    data: {
                        email: normalizedEmail,
                        name: name || null,
                        active: false,
                        confirmedAt: null,
                        confirmToken: null,
                        tokenExpiresAt: null,
                        locale: userLocale,
                        botScore,
                        ...(country ? { country } : {}),
                    },
                })
            }

            console.info(`[subscribe] Silent capture (manual_approval): ${normalizedEmail} — botScore=${botScore}${breakdownStr ? ` [${breakdownStr}]` : ''}`)
            // Return `welcomed` so the UI skips the "check inbox" state and goes straight
            // to the Create Account CTA — no email is sent in manual_approval mode.
            return NextResponse.json({ success: true, welcomed: true })
        }

        // ── DOUBLE OPT-IN MODE ───────────────────────────────────────────────
        // Legacy path — preserved for when we flip back to automated mode at scale.

        // ── Auto-suppress high-risk bots (score ≥ 80) ─────────────────────────
        if (botScore >= 80) {
            const existingUser = await db.user.findFirst({ where: { email: normalizedEmail }, select: { id: true } })
            if (!existingUser) {
                await suppressEmail(normalizedEmail, 'bot', `Auto-detected at subscribe: score ${botScore} [${breakdownStr}]`, 'subscribe')
                console.warn(`[subscribe] HIGH-RISK BOT suppressed: ${normalizedEmail} (score=${botScore}, country=${country}, breakdown: ${breakdownStr})`)
                return NextResponse.json({ success: true, pending: true }) // silent fake success
            }
        }
        // ── Soft-fail tier (70–79): log warning but allow through double opt-in ──
        if (botScore >= 70) {
            console.warn(`[subscribe] BORDERLINE risk: ${normalizedEmail} (score=${botScore}, country=${country}, breakdown: ${breakdownStr}) — allowing through double opt-in`)
        }

        const confirmToken    = crypto.randomUUID()
        const tokenExpiresAt  = new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours

        if (existing && !existing.confirmedAt) {
            // Pending — refresh token and resend confirmation
            await db.subscriber.update({
                where: { email: normalizedEmail },
                data: { confirmToken, tokenExpiresAt, locale: userLocale, botScore, ...(name ? { name } : {}) },
            })
        } else {
            // Brand new subscriber — create as inactive pending confirmation
            await db.subscriber.create({
                data: {
                    email: normalizedEmail, name: name || null,
                    active: false, confirmedAt: null,
                    confirmToken, tokenExpiresAt,
                    locale: userLocale, botScore,
                    ...(country ? { country } : {}),
                },
            })
        }

        // Send double opt-in confirmation email
        const confirmUrl = `${siteUrl}/api/subscribe/confirm?token=${confirmToken}`
        sendEmail({
            to: normalizedEmail,
            subject: 'Confirm your AIM Studio subscription 📬',
            html: subscribeConfirmation(name || undefined, siteUrl, confirmUrl, userLocale),
            type: 'authentication',
            isTransactional: true,
        }).catch(err => console.error('[subscribe] Confirm email failed:', err))

        return NextResponse.json({ success: true, pending: true })
    } catch (error) {
        console.error('Subscribe error:', error)
        return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
    }
}
