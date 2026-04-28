/**
 * GET /api/unsubscribe?token=...
 * POST /api/unsubscribe (RFC 8058 one-click)
 *
 * One-click unsubscribe handler. Verifies the HMAC token and:
 *   - subscriber → sets Subscriber.active = false + creates EmailSuppression
 *   - member     → sets UserNotificationPreference.contentPublish = false
 *
 * GET:  Redirects to /[locale]/unsubscribe?status=success|invalid
 * POST: Returns 200 (for Gmail/Yahoo one-click via List-Unsubscribe-Post)
 *
 * No login required. No multi-step flow — one click is enough per CAN-SPAM / GDPR.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyUnsubscribeToken } from '@/lib/unsubscribe-token'
import { prisma } from '@/lib/db'
import { suppressEmail } from '@/lib/suppression'
import { logger } from '@/lib/logger'

// ── Shared unsubscribe logic ───────────────────────────────────────────────

async function processUnsubscribe(email: string, type: 'subscriber' | 'member'): Promise<void> {
    const normalized = email.toLowerCase()

    if (type === 'subscriber') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).subscriber.updateMany({
            where: { email: normalized },
            data: { active: false },
        })

        // Feed into suppression engine — prevents future sends via ALL paths
        await suppressEmail(
            normalized,
            'unsubscribe',
            'User unsubscribed via email link',
            'unsubscribe_link'
        )

        logger.info('unsubscribe', `Subscriber unsubscribed: ${normalized}`)
    } else {
        // Registered member — disable content publish preference
        const user = await prisma.user.findUnique({
            where: { email: normalized },
            select: { id: true },
        })
        if (user) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma as any).userNotificationPreference.upsert({
                where: { userId: user.id },
                update: { contentPublish: false },
                create: {
                    userId: user.id,
                    contentPublish: false,
                    newRole: true,
                    announcement: true,
                    statusChange: true,
                    email: true,
                    inApp: true,
                    sms: false,
                },
            })
        }

        logger.info('unsubscribe', `Member unsubscribed from content publish: ${normalized}`)
    }
}

// ── GET handler — browser redirect flow ────────────────────────────────────

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''

    if (!token) {
        return NextResponse.redirect(`${siteUrl}/en/unsubscribe?status=invalid`)
    }

    const parsed = verifyUnsubscribeToken(token)
    if (!parsed) {
        return NextResponse.redirect(`${siteUrl}/en/unsubscribe?status=invalid`)
    }

    const { email, type } = parsed

    try {
        await processUnsubscribe(email, type)
        return NextResponse.redirect(`${siteUrl}/en/unsubscribe?status=success&type=${type}`)
    } catch (err) {
        console.error('[unsubscribe] Error:', err)
        return NextResponse.redirect(`${siteUrl}/en/unsubscribe?status=error`)
    }
}

// ── POST handler — RFC 8058 one-click unsubscribe ──────────────────────────
// Gmail sends: POST with body "List-Unsubscribe=One-Click"
// The token is in the query string of the List-Unsubscribe URL

export async function POST(request: NextRequest) {
    // Token can be in query string (from List-Unsubscribe header URL)
    // or in the POST body (some ESPs send it there)
    const url = new URL(request.url)
    let token = url.searchParams.get('token')

    if (!token) {
        try {
            const body = await request.text()
            const params = new URLSearchParams(body)
            token = params.get('token')
        } catch { /* body parse failure — token stays null */ }
    }

    if (!token) {
        return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const parsed = verifyUnsubscribeToken(token)
    if (!parsed) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }

    try {
        await processUnsubscribe(parsed.email, parsed.type)
        return new Response('Unsubscribed', { status: 200 })
    } catch (err) {
        logger.error('unsubscribe', 'One-click unsubscribe failed', { error: err as Error })
        return NextResponse.json({ error: 'Failed' }, { status: 500 })
    }
}
