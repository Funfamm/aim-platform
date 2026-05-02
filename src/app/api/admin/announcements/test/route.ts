import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { announcementEmail } from '@/lib/email-templates'
import { prisma } from '@/lib/db'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── Rate limiter — max 5 test emails per admin per minute ──────────────────
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 5
const rateBuckets = new Map<string, number[]>()

function checkRateLimit(adminId: string): boolean {
    const now = Date.now()
    const bucket = rateBuckets.get(adminId)?.filter(ts => now - ts < RATE_WINDOW_MS) ?? []
    rateBuckets.set(adminId, bucket)
    if (bucket.length >= RATE_MAX) return false
    bucket.push(now)
    return true
}

/**
 * POST /api/admin/announcements/test
 * Queues a single test email to the specified address using the outreach composer fields.
 * Validates email format and all required fields before queuing.
 * Rate-limited: max 5 test emails per admin per minute.
 */
export async function POST(req: Request) {
    let adminSession: { userId?: string }
    try { adminSession = await requireAdmin() as { userId?: string } } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Rate limit
    const adminId = adminSession?.userId || 'unknown'
    if (!checkRateLimit(adminId)) {
        return NextResponse.json({ error: 'Rate limit exceeded — max 5 test emails per minute' }, { status: 429 })
    }

    let body: Record<string, unknown>
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { testEmail, title, message, bodyHtml, imageUrl, link, type, ctaText, ctaUrl, ctaColor } = body as {
        testEmail?: string
        title?: string
        message?: string
        bodyHtml?: string
        imageUrl?: string
        link?: string
        type?: string
        ctaText?: string
        ctaUrl?: string
        ctaColor?: string
    }

    // ── Validation ──────────────────────────────────────────────────────────────
    if (!testEmail || !title?.trim() || !message?.trim()) {
        return NextResponse.json({ error: 'testEmail, title, and message are required' }, { status: 400 })
    }
    if (!EMAIL_RE.test(testEmail)) {
        return NextResponse.json({ error: 'Invalid email address format' }, { status: 400 })
    }
    if (ctaUrl && !/^(\/|https:\/\/)/.test(ctaUrl)) {
        return NextResponse.json({ error: 'ctaUrl must be a relative path (/) or https URL' }, { status: 400 })
    }

    // ── Build email ─────────────────────────────────────────────────────────────
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
    const ctaOverride = (ctaText && ctaUrl) ? { text: ctaText, url: ctaUrl, color: ctaColor || '#c9a84c' } : undefined
    const html = announcementEmail(title.trim(), message.trim(), link, siteUrl, undefined, imageUrl, bodyHtml, 'en', ctaOverride)

    const typeIcon = type === 'survey' ? '📊' : type === 'campaign' ? '📧' : '📣'

    try {
        await db.emailQueue.create({
            data: {
                to: testEmail,
                subject: `[TEST] ${typeIcon} ${title.trim()} | AIM Studio`,
                html,
                type: `${type || 'announcement'}_test`,
                priority: 0,
                status: 'pending',
            },
        })
    } catch (err) {
        console.error('[test-send] Queue error:', err)
        return NextResponse.json({ error: 'Failed to queue test email' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: `Test email queued to ${testEmail}` })
}
