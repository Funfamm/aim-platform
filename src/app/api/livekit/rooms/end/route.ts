import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getRoomServiceClient } from '@/lib/livekit/server'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
    try {
        await requireAdmin()

        const body = await req.json()
        const { roomName } = body

        if (!roomName) {
            return NextResponse.json({ error: 'roomName is required' }, { status: 400 })
        }

        const event = await prisma.liveEvent.findUnique({ where: { roomName } })
        if (!event) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 })
        }
        if (event.status === 'ended') {
            return NextResponse.json({ error: 'Room already ended' }, { status: 409 })
        }

        // Remove all participants and delete the LiveKit room.
        // The room may have been garbage-collected by LiveKit already (empty timeout),
        // so we tolerate "not found" errors here — the goal is just to update our DB.
        const client = getRoomServiceClient()
        try {
            await client.deleteRoom(roomName)
        } catch (err) {
            const msg = String(err)
            const alreadyGone =
                msg.includes('room not found') ||
                msg.includes('room_not_found') ||
                msg.includes('NOT_FOUND') ||
                msg.includes('status code 5')
            if (!alreadyGone) {
                // Unexpected error — re-throw so the outer catch can log it
                throw err
            }
            console.warn(`[rooms/end] LiveKit room '${roomName}' was already GC'd — proceeding to mark as ended in DB`)
        }

        // Mark as ended in DB
        const updated = await prisma.liveEvent.update({
            where: { roomName },
            data: { status: 'ended', endedAt: new Date() },
        })

        return NextResponse.json({ event: updated })
    } catch (error) {
        console.error('[livekit/rooms/end] error', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
