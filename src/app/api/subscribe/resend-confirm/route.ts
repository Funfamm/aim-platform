/**
 * POST /api/subscribe/resend-confirm
 *
 * Resends a confirmation email with a fresh 72h token.
 * Called from the /subscribe/confirmed?status=expired page.
 * Rate-limited: max 3 resend attempts per email per hour.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/mailer'
import { subscribeConfirmation } from '@/lib/email-templates'
import crypto from 'crypto'

const resendAttempts = new Map<string, number[]>()

function isResendRateLimited(email: string): boolean {
    const now = Date.now()
    const windowMs = 60 * 60 * 1000
    const attempts = (resendAttempts.get(email) || []).filter(t => now - t < windowMs)
    if (attempts.length >= 3) return true
    attempts.push(now)
    resendAttempts.set(email, attempts)
    return false
}

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json()
        if (!email || typeof email !== 'string') {
            return NextResponse.json({ error: 'Email required' }, { status: 400 })
        }

        const normalized = email.trim().toLowerCase()

        if (isResendRateLimited(normalized)) {
            return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any
        const subscriber = await db.subscriber.findUnique({
            where: { email: normalized },
            select: { id: true, name: true, active: true, confirmedAt: true, locale: true },
        })

        // Always return success — don't leak whether email is in DB
        if (!subscriber || subscriber.active || subscriber.confirmedAt) {
            return NextResponse.json({ success: true })
        }

        const confirmToken = crypto.randomUUID()
        const tokenExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)

        await db.subscriber.update({
            where: { id: subscriber.id },
            data: { confirmToken, tokenExpiresAt },
        })

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
        const confirmUrl = `${siteUrl}/api/subscribe/confirm?token=${confirmToken}`
        const locale = subscriber.locale || 'en'

        sendTransactionalEmail({
            to: normalized,
            subject: 'Confirm your AIM Studio subscription 🎬',
            html: await subscribeConfirmation(subscriber.name || undefined, siteUrl, confirmUrl, locale),
            type: 'subscribe',
        }).catch(err => console.error('[resend-confirm] Email failed:', err))

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[resend-confirm] Error:', err)
        return NextResponse.json({ error: 'Failed to resend' }, { status: 500 })
    }
}
