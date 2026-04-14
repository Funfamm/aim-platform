import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getRoomServiceClient } from '@/lib/livekit/server'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
    try {
        const session = await requireAdmin()

        const body = await req.json()
        const { title, roomName, eventType = 'general', projectId, castingCallId } = body

        if (!title || !roomName) {
            return NextResponse.json({ error: 'title and roomName are required' }, { status: 400 })
        }

        // Validate roomName is URL-safe
        if (!/^[a-zA-Z0-9_-]+$/.test(roomName)) {
            return NextResponse.json({ error: 'roomName must be alphanumeric with _ or -' }, { status: 400 })
        }

        // Create the room in LiveKit
        const client = getRoomServiceClient()
        await client.createRoom({
            name: roomName,
            emptyTimeout: 300,      // close after 5 min if empty
            maxParticipants: 100,
            metadata: JSON.stringify({ title, eventType }),
        })

        // Persist in DB
        const event = await prisma.liveEvent.create({
            data: {
                title,
                roomName,
                eventType,
                status: 'scheduled',
                hostUserId: session.userId,
                projectId: projectId || null,
                castingCallId: castingCallId || null,
            },
        })

        return NextResponse.json({ event })
    } catch (error) {
        console.error('[livekit/rooms/create] error', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
