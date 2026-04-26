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
export async function GET() {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const announcements = await db.announcement.findMany({
        orderBy: { sentAt: 'desc' },
        take: 50,
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
            sentAt: true,
        },
    })

    return NextResponse.json({ announcements })
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
    const { title, message, link, translations, bodyHtml, imageUrl, notifyGroups, specificUserIds } = body as {
        title?: string
        message?: string
        link?: string
        translations?: Record<string, Record<string, string>>
        bodyHtml?: string
        imageUrl?: string
        notifyGroups?: { subscribers?: boolean; members?: boolean; cast?: boolean }
        specificUserIds?: string[]
    }

    if (!title || !message) {
        return NextResponse.json({ error: 'title and message are required' }, { status: 400 })
    }

    // Server-side length enforcement — mirrors the frontend maxLength constraints.
    // A malicious or misconfigured client could bypass the UI, so we enforce here too.
    if (title.trim().length > 100) {
        return NextResponse.json({ error: 'title must be 100 characters or fewer' }, { status: 400 })
    }
    if (message.trim().length > 500) {
        return NextResponse.json({ error: 'message must be 500 characters or fewer' }, { status: 400 })
    }

    // Validate optional imageUrl — only https URLs allowed (prevents javascript: injection)
    if (imageUrl && !/^https:\/\//.test(imageUrl)) {
        return NextResponse.json({ error: 'imageUrl must be a valid https URL' }, { status: 400 })
    }

    // Read audience selection — default to nobody if omitted (admin must opt-in each group)
    const groups: { subscribers?: boolean; members?: boolean; cast?: boolean } = notifyGroups ?? {
        subscribers: false, members: false, cast: false,
    }

    const sentById = adminSession?.userId ?? null

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
                recipientCount: 0, // updated async
                status: 'sent',
                sentById,
            },
        })
    } catch (err) {
        console.error('[announcements] failed to save history record:', err)
    }

    // Fire-and-forget — returns immediately; delivery is async
    notifyAnnouncement(title, message, link, translations ?? null, imageUrl, bodyHtml, groups, specificUserIds).catch((err) => {
        console.error('[announcements] broadcast failed:', err)
    })

    return NextResponse.json({ success: true, queued: true })
}
