import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { notifyAnnouncement } from '@/lib/notifications'
import { prisma } from '@/lib/db'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

/**
 * POST /api/admin/announcements/[id]/resend
 * Re-broadcasts a previously sent announcement to a (possibly updated) audience.
 *
 * Body (optional):
 *   notifyGroups?: { subscribers?: boolean; members?: boolean; cast?: boolean }
 *   specificUserIds?: string[]
 *
 * If body is empty, the original audience selection is reused.
 * The saved translations are reused so no re-translation is needed.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Load the original announcement record
    const announcement = await db.announcement.findUnique({
        where: { id },
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
        },
    })

    if (!announcement) {
        return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
    }

    // Parse optional overrides from the request body
    let overrideGroups: { subscribers?: boolean; members?: boolean; cast?: boolean } | undefined
    let overrideUserIds: string[] | undefined
    try {
        const body = await req.json()
        if (body.notifyGroups) overrideGroups = body.notifyGroups
        if (body.specificUserIds) overrideUserIds = body.specificUserIds
    } catch {
        // No body or malformed — fall back to original
    }

    // Determine audience
    let groups: { subscribers?: boolean; members?: boolean; cast?: boolean }
    if (overrideGroups) {
        groups = overrideGroups
    } else {
        try {
            groups = announcement.audienceGroups ? JSON.parse(announcement.audienceGroups) : { members: true }
        } catch {
            groups = { members: true }
        }
    }

    let specificUserIds: string[] | undefined
    if (overrideUserIds) {
        specificUserIds = overrideUserIds
    } else {
        try {
            specificUserIds = announcement.specificUserIds ? JSON.parse(announcement.specificUserIds) : undefined
        } catch {
            specificUserIds = undefined
        }
    }

    // Parse saved translations
    let translations: Record<string, Record<string, string>> | null = null
    try {
        translations = announcement.translations ? JSON.parse(announcement.translations) : null
    } catch {
        translations = null
    }

    // Log the resend as a new Announcement record for audit trail
    try {
        await db.announcement.create({
            data: {
                title: announcement.title,
                message: announcement.message,
                bodyHtml: announcement.bodyHtml || null,
                imageUrl: announcement.imageUrl || null,
                link: announcement.link || null,
                translations: announcement.translations || null,
                audienceGroups: JSON.stringify(groups),
                specificUserIds: specificUserIds?.length ? JSON.stringify(specificUserIds) : null,
                recipientCount: 0,
                status: 'sent',
                sentById: null,
            },
        })
    } catch (err) {
        console.error('[announcements/resend] failed to save resend record:', err)
    }

    // Re-broadcast with original content + translations
    notifyAnnouncement(
        announcement.title,
        announcement.message,
        announcement.link || undefined,
        translations,
        announcement.imageUrl || undefined,
        announcement.bodyHtml || undefined,
        groups,
        specificUserIds,
    ).catch((err) => {
        console.error('[announcements/resend] broadcast failed:', err)
    })

    return NextResponse.json({ success: true, resent: true })
}
