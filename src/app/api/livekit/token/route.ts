import { NextResponse } from 'next/server'
import { getSessionAndRefresh } from '@/lib/auth'
import { createAccessToken, getRoomServiceClient, getLiveKitWsUrl } from '@/lib/livekit/server'
import { grantsForRole, type LiveKitRole } from '@/lib/livekit/grants'
import { canJoinRoom } from '@/lib/livekit/permissions'
import { rateLimit } from '@/lib/rate-limit'
import { prisma } from '@/lib/db'

// 60 token mints per minute per IP — sufficient for all reconnect scenarios.
// Each mint hits canJoinRoom() (1 DB read) so keep comfortably below Vercel's
// DB connection limit. Raise to 120 if running dedicated DB connection pooling.
const livekitTokenLimiter = rateLimit({ interval: 60_000, limit: 60 })

const VALID_ROLES: LiveKitRole[] = ['admin', 'host', 'speaker', 'viewer']

export async function POST(req: Request) {
    try {
        const rateLimited = livekitTokenLimiter.check(req)
        if (rateLimited) return rateLimited

        const session = await getSessionAndRefresh()
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

        // Treat any elevated platform role as an admin for LiveKit purposes.
        // The null-safe check handles sessions where `role` was not stored (legacy tokens).
        const ADMIN_ROLES = ['admin', 'superadmin'] as const
        const isAdmin = ADMIN_ROLES.includes((session.role ?? '') as typeof ADMIN_ROLES[number])
        if (!session.role) {
            console.warn('[livekit/token] session.role missing for userId', session.userId, '— defaulting to non-admin')
        }

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
            emptyTimeout: 7200,      // keep room alive 2 hrs after last participant leaves
            departureTimeout: 120,   // 2 min grace after all participants depart before teardown
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

        // getLiveKitWsUrl() always returns a wss:// URL regardless of how
        // LIVEKIT_URL was written in .env — prevents the client connecting to
        // a different LiveKit instance than the one rooms were created on.
        return NextResponse.json({
            token,
            wsUrl: getLiveKitWsUrl(),
            roomName,
            identity: session.userId,
            role: isAdmin ? 'admin' : role,
        })
    } catch (error) {
        console.error('[livekit/token] error', error instanceof Error ? error.message : error)
        const msg = error instanceof Error ? error.message : 'Internal server error'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
