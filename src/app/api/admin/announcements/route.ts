import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { notifyAnnouncement } from '@/lib/notifications'

/**
 * POST /api/admin/announcements
 * Broadcasts an announcement notification to all opted-in users.
 * Body: { title: string; message: string; link?: string }
 */
export async function POST(req: Request) {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { title, message, link } = body as { title?: string; message?: string; link?: string }

    if (!title || !message) {
        return NextResponse.json({ error: 'title and message are required' }, { status: 400 })
    }

    // Fire-and-forget — returns immediately; delivery is async via BullMQ
    notifyAnnouncement(title, message, link).catch((err) => {
        console.error('[announcements] broadcast failed:', err)
    })

    return NextResponse.json({ success: true, queued: true })
}
