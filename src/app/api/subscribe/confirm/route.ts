/**
 * GET /api/subscribe/confirm?token=...
 *
 * Activates a pending newsletter subscription.
 * - Checks token exists and has not expired (72h window)
 * - Marks subscriber active, clears token
 * - Sends welcome email
 * - Redirects to /[locale]/subscribe/confirmed?status=success|expired|invalid|error
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendTransactionalEmail } from '@/lib/email-router'
import { subscribeWelcomeWithOverrides } from '@/lib/email-templates'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''

    if (!token) {
        return NextResponse.redirect(`${siteUrl}/en/subscribe/confirmed?status=invalid`)
    }

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any

        const subscriber = await db.subscriber.findFirst({
            where: { confirmToken: token },
            select: { id: true, email: true, name: true, locale: true, tokenExpiresAt: true },
        })

        if (!subscriber) {
            return NextResponse.redirect(`${siteUrl}/en/subscribe/confirmed?status=invalid`)
        }

        // ── Check token expiry ────────────────────────────────────────────────
        if (subscriber.tokenExpiresAt && new Date(subscriber.tokenExpiresAt) < new Date()) {
            const encodedEmail = encodeURIComponent(subscriber.email)
            return NextResponse.redirect(
                `${siteUrl}/en/subscribe/confirmed?status=expired&email=${encodedEmail}`
            )
        }

        // ── Activate subscriber ───────────────────────────────────────────────
        await db.subscriber.update({
            where: { id: subscriber.id },
            data: {
                active: true,
                confirmToken: null,
                tokenExpiresAt: null,
                confirmedAt: new Date(),
            },
        })

        // ── Send welcome email ────────────────────────────────────────────────
        const locale = subscriber.locale || 'en'
        sendTransactionalEmail({
            to: subscriber.email,
            subject: 'Welcome to AIM Studio! 🎬',
            html: await subscribeWelcomeWithOverrides(subscriber.name || undefined, siteUrl, locale),
            type: 'subscribe',
        }).catch(err => console.error('[subscribe/confirm] Welcome email failed:', err))

        return NextResponse.redirect(`${siteUrl}/en/subscribe/confirmed?status=success`)
    } catch (err) {
        console.error('[subscribe/confirm] Error:', err)
        return NextResponse.redirect(`${siteUrl}/en/subscribe/confirmed?status=error`)
    }
}
