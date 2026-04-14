import { NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { createAccessToken, getRoomServiceClient } from '@/lib/livekit/server'
import { grantsForRole, type LiveKitRole } from '@/lib/livekit/grants'
import { canJoinRoom } from '@/lib/livekit/permissions'
import { rateLimit } from '@/lib/rate-limit'
import { prisma } from '@/lib/db'

// 20 token mints per minute per IP — tight because each mint hits canJoinRoom() (DB read)
const livekitTokenLimiter = rateLimit({ interval: 60_000, limit: 20 })

const VALID_ROLES: LiveKitRole[] = ['admin', 'host', 'speaker', 'viewer']

export async function POST(req: Request) {
    try {
        const rateLimited = livekitTokenLimiter.check(req)
        if (rateLimited) return rateLimited

        const session = await getUserSession()
        if (!session?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const roomName = String(body.roomName || '').trim()
        const role = (body.role || 'viewer') as LiveKitRole
        const preferredCaptionLang = body.preferredCaptionLang || 'en'

        if (!roomName) {
            return NextResponse.json({ error: 'roomName is required' }, { status: 400 })
        }
        if (!VALID_ROLES.includes(role)) {
            return NextResponse.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 })
        }

        const isAdmin = session.role === 'admin' || session.role === 'superadmin'

        // Authorization check — verifies room exists in DB and user is permitted
        const { allowed, reason } = await canJoinRoom(session.userId, roomName, role, isAdmin)
        if (!allowed) {
            return NextResponse.json({ error: reason || 'Forbidden' }, { status: 403 })
        }

        // ── Just-in-time room provisioning ─────────────────────────────────
        // LiveKit's createRoom is idempotent — if the room already exists it
        // returns the existing room, if it was garbage-collected or never
        // created it provisions a fresh one. This ensures the WebSocket
        // connect will always succeed after the token is issued.
        const roomSvc = getRoomServiceClient()
        const event = await prisma.liveEvent.findUnique({
            where: { roomName },
            select: { title: true, eventType: true, status: true },
        })

        await roomSvc.createRoom({
            name: roomName,
            emptyTimeout: 300,       // auto-close 5 min after last participant leaves
            maxParticipants: 100,
            metadata: JSON.stringify({
                title: event?.title ?? roomName,
                eventType: event?.eventType ?? 'general',
            }),
        })

        // Transition scheduled → live on first join
        if (event?.status === 'scheduled') {
            await prisma.liveEvent.update({
                where: { roomName },
                data: { status: 'live', startedAt: new Date() },
            })
        }

        // Mint short-lived token (10 min)
        const participantName = (typeof session.name === 'string' && session.name) ? session.name : session.userId
        const at = createAccessToken(session.userId, participantName)
        at.addGrant(grantsForRole(isAdmin ? 'admin' : role, roomName))

        // Attach metadata the client + workers can use
        at.metadata = JSON.stringify({
            appUserId: session.userId,
            preferredCaptionLang,
            role: isAdmin ? 'admin' : role,
        })

        const token = await at.toJwt()

        return NextResponse.json({
            token,
            wsUrl: process.env.LIVEKIT_URL,
            roomName,
            identity: session.userId,
            role: isAdmin ? 'admin' : role,
        })
    } catch (error) {
        console.error('[livekit/token] error', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
