/**
 * GET /api/track/click
 * ---------------------------------------------------------------------------
 * Click tracking redirect proxy.
 *
 * Usage in email templates: href="/api/track/click?id=<logId>&url=<base64url_url>"
 *
 * Records clickedAt on the EmailLog row, then 302-redirects to the destination.
 * If the ID is missing or the URL is invalid, redirects to the site root safely.
 *
 * Security:
 *   - URL is base64url-encoded and validated with `new URL()` before redirect
 *   - Only allows http/https destinations (rejects javascript:, data:, etc.)
 *   - clickedAt only stamped on the first click (idempotent updateMany with filter)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const id  = searchParams.get('id')
    const raw = searchParams.get('url')

    // Decode and validate destination URL
    let destination: string
    try {
        if (!raw) throw new Error('missing url')
        destination = Buffer.from(raw, 'base64url').toString('utf-8')
        const parsed = new URL(destination)
        // Only allow safe protocols
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('unsafe protocol')
    } catch {
        return NextResponse.redirect(SITE_URL, { status: 302 })
    }

    // Stamp clickedAt asynchronously — never block the redirect on DB latency
    if (id) {
        prisma.emailLog.updateMany({
            where: { id, clickedAt: null },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: { clickedAt: new Date() } as any,
        }).catch(() => { /* non-critical */ })
    }

    return NextResponse.redirect(destination, { status: 302 })
}
