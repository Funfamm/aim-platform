import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { notifyAnnouncement } from '@/lib/notifications'

/**
 * POST /api/admin/announcements
 * Broadcasts an announcement notification to all opted-in users.
 * Body: { title: string; message: string; link?: string; translations?: Record<string, Record<string, string>> }
 *
 * When `translations` is provided (pre-built by /api/admin/announcements/translate),
 * notifyAnnouncement will skip the auto-translate step and use them directly —
 * guaranteeing every user receives the announcement in their own language.
 */
export async function POST(req: Request) {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { title, message, link, translations } = body as {
        title?: string
        message?: string
        link?: string
        translations?: Record<string, Record<string, string>>
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


    // Fire-and-forget — returns immediately; delivery is async
    notifyAnnouncement(title, message, link, translations ?? null).catch((err) => {
        console.error('[announcements] broadcast failed:', err)
    })

    return NextResponse.json({ success: true, queued: true })
}
