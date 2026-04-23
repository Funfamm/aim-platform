/**
 * GET /api/subscribe/confirm?token=...
 *
 * Activates a pending newsletter subscription.
 * Finds the subscriber by confirmToken, marks them active, clears the token.
 * Redirects to /[locale]/subscribe/confirmed on success.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

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
            select: { id: true, email: true },
        })

        if (!subscriber) {
            // Token not found — either already confirmed or invalid
            return NextResponse.redirect(`${siteUrl}/en/subscribe/confirmed?status=invalid`)
        }

        await db.subscriber.update({
            where: { id: subscriber.id },
            data: {
                active: true,
                confirmToken: null,
                confirmedAt: new Date(),
            },
        })

        return NextResponse.redirect(`${siteUrl}/en/subscribe/confirmed?status=success`)
    } catch (err) {
        console.error('[subscribe/confirm] Error:', err)
        return NextResponse.redirect(`${siteUrl}/en/subscribe/confirmed?status=error`)
    }
}
