import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Helper: is a LiveKit error "room does not exist"?
function isRoomNotFound(err: unknown): boolean {
    const msg = String(err).toLowerCase()
    return (
        msg.includes('room not found') ||
        msg.includes('room_not_found') ||
        msg.includes('not_found') ||
        msg.includes('status code 5') ||
        msg.includes('does not exist') ||
        msg.includes('404')
    )
}

export async function POST(req: Request) {
    let session
    try {
        session = await requireAdmin()
    } catch (authErr) {
        const msg = authErr instanceof Error ? authErr.message : 'Unauthorized'
        const status = msg.startsWith('Forbidden') ? 403 : 401
        return NextResponse.json({ error: msg }, { status })
    }

    let roomName: string | undefined
    try {
        const body = await req.json()
        roomName = body?.roomName
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (!roomName) {
        return NextResponse.json({ error: 'roomName is required' }, { status: 400 })
    }

    // ── DB guard ──────────────────────────────────────────────────────────────
    const event = await prisma.liveEvent.findUnique({ where: { roomName } })
    if (!event) {
        return NextResponse.json({ error: 'Room not found in database' }, { status: 404 })
    }
    if (event.status === 'ended') {
        return NextResponse.json({ error: 'Room already ended' }, { status: 409 })
    }

    // ── LiveKit deletion — always tolerate failure ────────────────────────────
    // We NEVER want a LiveKit SDK error to prevent the DB record from being
    // marked as ended. Even if LIVEKIT_URL is misconfigured or the room was
    // garbage-collected, the admin must be able to mark the session as ended.
    let liveKitWarning: string | null = null
    try {
        // Lazy-import so a missing LIVEKIT_URL doesn't throw before we even try
        const { getRoomServiceClient } = await import('@/lib/livekit/server')
        const client = getRoomServiceClient()
        await client.deleteRoom(roomName)
    } catch (err) {
        if (isRoomNotFound(err)) {
            liveKitWarning = `LiveKit room '${roomName}' was already removed (GC'd or never created).`
            console.warn('[rooms/end]', liveKitWarning)
        } else {
            // Non-fatal: log the real error but don't block the DB update
            liveKitWarning = `LiveKit deleteRoom failed (${String(err).slice(0, 120)}). DB will still be marked ended.`
            console.error('[rooms/end] deleteRoom unexpected error:', err)
        }
    }

    // ── Always mark ended in DB ───────────────────────────────────────────────
    let updated
    try {
        updated = await prisma.liveEvent.update({
            where: { roomName },
            data: { status: 'ended', endedAt: new Date() },
        })
    } catch (dbErr) {
        console.error('[rooms/end] DB update failed:', dbErr)
        return NextResponse.json(
            { error: 'Failed to update room status in database' },
            { status: 500 },
        )
    }

    return NextResponse.json({
        event: updated,
        ...(liveKitWarning ? { warning: liveKitWarning } : {}),
    })
}
