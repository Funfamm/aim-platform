import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
    try {
        const session = await requireAdmin()

        const body = await req.json()
        const {
            title, roomName, eventType = 'general',
            projectId, castingCallId,
            scheduledAt, lobbyEnabled, replayEnabled,
            permissions,
        } = body

        if (!title || !roomName) {
            return NextResponse.json({ error: 'title and roomName are required' }, { status: 400 })
        }

        // Validate roomName is URL-safe
        if (!/^[a-zA-Z0-9_-]+$/.test(roomName)) {
            return NextResponse.json({ error: 'roomName must be alphanumeric with _ or -' }, { status: 400 })
        }

        // NOTE: We do NOT create the room on LiveKit here.
        // LiveKit rooms with emptyTimeout auto-delete after N seconds with no
        // participants, so creating at schedule time means the room will be
        // garbage-collected before anyone joins.
        // Instead, the room is lazily created in /api/livekit/token when the
        // first participant requests a token ("just-in-time provisioning").

        // Persist in DB
        const event = await prisma.liveEvent.create({
            data: {
                title,
                roomName,
                eventType,
                status:       'scheduled',
                hostUserId:   session.userId,
                projectId:    projectId || null,
                castingCallId: castingCallId || null,
                scheduledAt:  scheduledAt ? new Date(scheduledAt) : null,
                lobbyEnabled: eventType === 'watch_party' ? (lobbyEnabled !== false) : false,
                replayEnabled: eventType === 'watch_party' ? (replayEnabled === true) : false,
                // Store participant capability permissions for LiveKit events
                permissions: (eventType !== 'watch_party' && permissions) ? permissions : undefined,
            },
        })

        return NextResponse.json({ event })
    } catch (error) {
        console.error('[livekit/rooms/create] error', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
