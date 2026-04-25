import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendTransactionalEmail } from '@/lib/email-router'
import { translateContent } from '@/lib/translate'

/**
 * POST /api/admin/sponsors/notify
 * Sends a transactional email to a specific sponsor's contact address.
 * Optionally translates the message to the detected/requested locale via Gemini AI.
 *
 * Body: { sponsorId, subject, message, translate?: boolean }
 *
 * Rate-limited: max 3 sends per sponsor per hour (in-process)
 */

// Simple in-process rate limiter: sponsorId → [timestamps]
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT_COUNT = 3
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function isRateLimited(sponsorId: string): boolean {
    const now = Date.now()
    const timestamps = (rateLimitMap.get(sponsorId) ?? []).filter(ts => now - ts < RATE_LIMIT_WINDOW_MS)
    if (timestamps.length >= RATE_LIMIT_COUNT) return true
    rateLimitMap.set(sponsorId, [...timestamps, now])
    return false
}

export async function POST(req: NextRequest) {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { sponsorId, subject, message, translate: doTranslate } = body as {
        sponsorId?: string
        subject?: string
        message?: string
        translate?: boolean
    }

    if (!sponsorId || !subject?.trim() || !message?.trim()) {
        return NextResponse.json({ error: 'sponsorId, subject, and message are required' }, { status: 400 })
    }

    // Fetch sponsor — verify it exists and has a contact email
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sponsor = await (prisma as any).sponsor.findUnique({
        where: { id: sponsorId },
        select: { id: true, name: true, contactEmail: true },
    })

    if (!sponsor) {
        return NextResponse.json({ error: 'Sponsor not found' }, { status: 404 })
    }
    if (!sponsor.contactEmail) {
        return NextResponse.json({ error: 'This sponsor has no contact email on file' }, { status: 400 })
    }

    // Rate limit check
    if (isRateLimited(sponsorId)) {
        return NextResponse.json({
            error: `Rate limit: max ${RATE_LIMIT_COUNT} emails per sponsor per hour`,
        }, { status: 429 })
    }

    let finalSubject = subject.trim()
    let finalMessage = message.trim()

    // Optional Gemini-powered translation (admin opt-in, uses 'all' agent pool)
    if (doTranslate) {
        try {
            const translations = await translateContent(
                { subject: finalSubject, message: finalMessage },
                'all',
            )
            // Use English translation if AI returns one (usually identical, but preserves consistency)
            if (translations?.en) {
                finalSubject = translations.en.subject || finalSubject
                finalMessage = translations.en.message || finalMessage
            }
        } catch {
            // Non-critical — fall through and send English version
        }
    }

    // Build clean HTML email
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
    const siteName = 'AIM Studio'
    const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:580px;margin:0 auto;padding:40px 24px;background:#0a0a0a;color:#e1e1e1;">
            <div style="margin-bottom:28px;">
                <span style="display:inline-block;padding:4px 12px;background:rgba(212,168,83,0.1);border:1px solid rgba(212,168,83,0.2);border-radius:20px;font-size:0.7rem;font-weight:700;color:#d4a853;letter-spacing:0.08em;text-transform:uppercase;">
                    Sponsor Update
                </span>
            </div>
            <h2 style="color:#d4a853;font-size:1.3rem;margin:0 0 20px;">${finalSubject}</h2>
            <div style="color:#ccc;font-size:0.95rem;line-height:1.7;white-space:pre-line;">${finalMessage}</div>
            <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:32px 0;">
            <div style="font-size:0.72rem;color:#666;">
                This message was sent to you as a ${siteName} sponsor partner.
                If you have questions, reply to this email or visit <a href="${siteUrl}" style="color:#d4a853;">${siteUrl}</a>.
            </div>
        </div>
    `.trim()

    const sent = await sendTransactionalEmail({
        to: sponsor.contactEmail,
        subject: `[${siteName}] ${finalSubject}`,
        html,
    })

    if (!sent) {
        return NextResponse.json({ error: 'Email failed to send — check your SMTP/Graph configuration' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, email: sponsor.contactEmail, sponsorName: sponsor.name })
}
