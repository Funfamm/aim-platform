import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { notifyAnnouncement } from '@/lib/notifications'
import { prisma } from '@/lib/db'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

/**
 * GET /api/admin/announcements
 * Returns paginated announcement history (newest first).
 */
export async function GET(req: Request) {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
    const perPage = 30
    const typeFilter = url.searchParams.get('type') // optional: 'announcement' | 'survey' | 'campaign'

    const where = typeFilter ? { type: typeFilter } : {}

    const [announcements, total] = await Promise.all([
        db.announcement.findMany({
            where,
            orderBy: { sentAt: 'desc' },
            skip: (page - 1) * perPage,
            take: perPage,
            select: {
                id: true,
                title: true,
                message: true,
                bodyHtml: true,
                imageUrl: true,
                link: true,
                translations: true,
                audienceGroups: true,
                specificUserIds: true,
                recipientCount: true,
                status: true,
                type: true,
                ctaText: true,
                ctaUrl: true,
                ctaColor: true,
                sentAt: true,
                scheduledAt: true,
            },
        }),
        db.announcement.count({ where }),
    ])

    return NextResponse.json({ announcements, total, page, totalPages: Math.ceil(total / perPage) })
}

/**
 * POST /api/admin/announcements
 * Broadcasts an announcement notification to all opted-in users.
 * Body: { title, message, link?, translations?, bodyHtml?, imageUrl? }
 *
 * When `translations` is provided (pre-built by /api/admin/announcements/translate),
 * notifyAnnouncement will skip the auto-translate step and use them directly —
 * guaranteeing every user receives the announcement in their own language.
 * bodyHtml and imageUrl are optional rich-content fields that appear in the email.
 */
export async function POST(req: Request) {
    let adminSession;
    try { adminSession = await requireAdmin() } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { title, message, link, translations, bodyHtml, imageUrl, notifyGroups, specificUserIds, type, ctaText, ctaUrl, ctaColor, scheduledAt } = body as {
        title?: string
        message?: string
        link?: string
        translations?: Record<string, Record<string, string>>
        bodyHtml?: string
        imageUrl?: string
        notifyGroups?: { subscribers?: boolean; members?: boolean; cast?: boolean }
        specificUserIds?: string[]
        type?: 'announcement' | 'survey' | 'campaign'
        ctaText?: string
        ctaUrl?: string
        ctaColor?: string
        scheduledAt?: string // ISO 8601 UTC string for future delivery
    }

    if (!title || !message) {
        return NextResponse.json({ error: 'title and message are required' }, { status: 400 })
    }

    // Server-side length enforcement — mirrors the frontend maxLength constraints.
    if (title.trim().length > 100) {
        return NextResponse.json({ error: 'title must be 100 characters or fewer' }, { status: 400 })
    }
    if (message.trim().length > 500) {
        return NextResponse.json({ error: 'message must be 500 characters or fewer' }, { status: 400 })
    }

    // Validate optional imageUrl
    if (imageUrl && !/^https:\/\//.test(imageUrl)) {
        return NextResponse.json({ error: 'imageUrl must be a valid https URL' }, { status: 400 })
    }

    // Validate CTA URL
    if (ctaUrl && !/^(\/|https:\/\/)/.test(ctaUrl)) {
        return NextResponse.json({ error: 'ctaUrl must be a relative path (/) or https URL' }, { status: 400 })
    }

    // Validate outreach type
    const outreachType = type && ['announcement', 'survey', 'campaign'].includes(type) ? type : 'announcement'

    // Validate scheduledAt — must be a valid future datetime (at least 1 minute from now)
    let scheduledDate: Date | null = null
    if (scheduledAt) {
        const parsed = new Date(scheduledAt)
        if (isNaN(parsed.getTime())) {
            return NextResponse.json({ error: 'scheduledAt must be a valid ISO datetime' }, { status: 400 })
        }
        if (parsed.getTime() < Date.now() + 60_000) {
            return NextResponse.json({ error: 'scheduledAt must be at least 1 minute in the future' }, { status: 400 })
        }
        scheduledDate = parsed
    }

    // Read audience selection
    const groups: { subscribers?: boolean; members?: boolean; cast?: boolean } = notifyGroups ?? {
        subscribers: false, members: false, cast: false,
    }

    const sentById = adminSession?.userId ?? null
    const isScheduled = scheduledDate !== null

    // Save announcement record
    try {
        await db.announcement.create({
            data: {
                title: title.trim(),
                message: message.trim(),
                bodyHtml: bodyHtml || null,
                imageUrl: imageUrl || null,
                link: link?.trim() || null,
                translations: translations ? JSON.stringify(translations) : null,
                audienceGroups: JSON.stringify(groups),
                specificUserIds: specificUserIds?.length ? JSON.stringify(specificUserIds) : null,
                recipientCount: 0,
                status: isScheduled ? 'scheduled' : 'sent',
                scheduledAt: scheduledDate,
                sentById,
                type: outreachType,
                ctaText: ctaText?.trim() || null,
                ctaUrl: ctaUrl?.trim() || null,
                ctaColor: ctaColor || '#c9a84c',
            },
        })
    } catch (err) {
        console.error('[announcements] failed to save history record:', err)
    }

    // If scheduled — return immediately; cron will fire at the right time
    if (isScheduled) {
        return NextResponse.json({ success: true, scheduled: true, scheduledAt: scheduledDate!.toISOString() })
    }

    // Immediate send — fire-and-forget
    const ctaOverride = (ctaText && ctaUrl) ? { text: ctaText.trim(), url: ctaUrl.trim(), color: ctaColor || '#c9a84c' } : undefined
    notifyAnnouncement(title, message, link, translations ?? null, imageUrl, bodyHtml, groups, specificUserIds, ctaOverride).catch((err) => {
        console.error('[announcements] broadcast failed:', err)
    })

    return NextResponse.json({ success: true, queued: true })
}

/**
 * DELETE /api/admin/announcements
 * Clears all announcement history records.
 */
export async function DELETE() {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const result = await db.announcement.deleteMany({})
        return NextResponse.json({ success: true, deleted: result.count })
    } catch (err) {
        console.error('[announcements] failed to clear history:', err)
        return NextResponse.json({ error: 'Failed to clear history' }, { status: 500 })
    }
}
