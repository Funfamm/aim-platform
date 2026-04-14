import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

// DELETE /api/livekit/rooms/[id]
// Admin-only hard delete. Two safety rules enforced atomically:
//   1. Live rooms CANNOT be deleted — must be ended first (status !== 'live').
//   2. Uses deleteMany with a WHERE clause so the live-room guard is atomic —
//      no race condition between the status-check and the delete.

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        await requireAdmin()

        const { id } = await params
        if (!id) {
            return NextResponse.json({ error: 'Event ID is required' }, { status: 400 })
        }

        // Atomic: delete only if the event exists AND is not live.
        // deleteMany returns { count: 0 } when nothing matched — never throws on not-found.
        const result = await prisma.liveEvent.deleteMany({
            where: {
                id,
                status: { not: 'live' },
            },
        })

        if (result.count === 0) {
            // Either the record doesn't exist OR it's currently live.
            // Run a lightweight check to return the right HTTP status.
            const exists = await prisma.liveEvent.findUnique({
                where: { id },
                select: { status: true },
            })

            if (!exists) {
                return NextResponse.json({ error: 'Event not found' }, { status: 404 })
            }

            // Record exists but status is 'live'
            return NextResponse.json(
                { error: 'Cannot delete a live room. End the event first.' },
                { status: 409 },
            )
        }

        return NextResponse.json({ ok: true, deleted: { id } })
    } catch (error) {
        const msg    = error instanceof Error ? error.message : 'Internal server error'
        const status = msg === 'Unauthorized' ? 401 : msg.startsWith('Forbidden') ? 403 : 500
        return NextResponse.json({ error: msg }, { status })
    }
}
