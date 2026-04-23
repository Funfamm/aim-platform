/**
 * GET /api/unsubscribe?token=...
 *
 * One-click unsubscribe handler. Verifies the HMAC token and:
 *   - subscriber → sets Subscriber.active = false
 *   - member     → sets UserNotificationPreference.contentPublish = false
 *
 * Redirects to /[locale]/unsubscribe?status=success|invalid
 * No login required. No multi-step flow — one click is enough per CAN-SPAM / GDPR.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyUnsubscribeToken } from '@/lib/unsubscribe-token'
import { prisma } from '@/lib/db'

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
        if (type === 'subscriber') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma as any).subscriber.updateMany({
                where: { email: email.toLowerCase() },
                data: { active: false },
            })
        } else {
            // Registered member — disable content publish preference
            const user = await prisma.user.findUnique({
                where: { email: email.toLowerCase() },
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
        }

        return NextResponse.redirect(`${siteUrl}/en/unsubscribe?status=success&type=${type}`)
    } catch (err) {
        console.error('[unsubscribe] Error:', err)
        return NextResponse.redirect(`${siteUrl}/en/unsubscribe?status=error`)
    }
}
