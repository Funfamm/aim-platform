import { NextResponse } from 'next/server'
import { TrackSource } from 'livekit-server-sdk'
import { getSessionAndRefresh } from '@/lib/auth'
import { createAccessToken, getRoomServiceClient, getLiveKitWsUrl } from '@/lib/livekit/server'
import { grantsForRole, type LiveKitRole } from '@/lib/livekit/grants'
import { canJoinRoom } from '@/lib/livekit/permissions'
import { rateLimit } from '@/lib/rate-limit'
import { prisma } from '@/lib/db'

// 60 token mints per minute per IP — sufficient for all reconnect scenarios.
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

        const ADMIN_ROLES = ['admin', 'superadmin'] as const
        const isAdmin = ADMIN_ROLES.includes((session.role ?? '') as typeof ADMIN_ROLES[number])
        if (!session.role) {
            console.warn('[livekit/token] session.role missing for userId', session.userId, '— defaulting to non-admin')
        }

        const { allowed, reason } = await canJoinRoom(session.userId, roomName, role, isAdmin)
        if (!allowed) {
            return NextResponse.json({ error: reason || 'Forbidden' }, { status: 403 })
        }

        // ── Fetch event ────────────────────────────────────────────────────────
        const roomSvc = getRoomServiceClient()
        let event = null
        try {
            event = await prisma.liveEvent.findUnique({
                where:  { roomName },
                select: { title: true, eventType: true, status: true, hostUserId: true },
            })
        } catch (e) {
            console.error('[livekit/token] DB error fetching event:', e)
        }
        if (!event) {
            return NextResponse.json({ error: 'Event not found or database unavailable' }, { status: 404 })
        }

        // ── Per-event participant permissions ──────────────────────────────────
        // IMPORTANT: canPublishSources must contain plain STRINGS, not numeric
        // TrackSource enum values. The SDK's AccessToken calls .toString() on each
        // entry during JWT serialization — numeric enum values (CAMERA=2, etc.)
        // produce "2" instead of "camera", causing a runtime 500 error.
        let permGrant: {
            canPublish?: boolean
            canPublishSources?: string[]
            canSubscribe?: boolean
        } = { canPublish: true, canSubscribe: true }

        if (!isAdmin && role !== 'host') {
            let event2: { permissions: unknown } | null = null
            try {
                event2 = await prisma.liveEvent.findUnique({
                    where:  { roomName },
                    select: { permissions: true },
                })
            } catch { /* non-critical */ }

            if (event2?.permissions) {
                const perms = event2.permissions as {
                    camera?: boolean
                    mic?: boolean
                    screenShare?: boolean
                }
                // Use string literals — NOT TrackSource enum values
                const sources: string[] = [
                    ...(perms.camera      !== false ? ['camera']       : []),
                    ...(perms.mic         !== false ? ['microphone']   : []),
                    ...(perms.screenShare !== false ? ['screen_share'] : []),
                ]
                permGrant = {
                    canPublish:        sources.length > 0,
                    canPublishSources: sources,
                    canSubscribe:      true,
                }
            }
        }

        // ── Provision room (idempotent) ────────────────────────────────────────
        await roomSvc.createRoom({
            name:             roomName,
            emptyTimeout:     7200,  // 2 hrs after last participant leaves
            departureTimeout: 120,   // 2 min grace before teardown
            maxParticipants:  100,
            metadata: JSON.stringify({
                title:     event.title ?? roomName,
                eventType: event.eventType ?? 'general',
            }),
        })

        // ── Transition scheduled → live ────────────────────────────────────────
        if (event.status === 'scheduled') {
            try {
                await prisma.liveEvent.update({
                    where: { roomName },
                    data:  { status: 'live', startedAt: new Date() },
                })
            } catch (e) {
                console.error('[livekit/token] Failed to transition event to live:', e)
            }
        }

        // ── Mint token ────────────────────────────────────────────────────────
        const participantName = (typeof session.name === 'string' && session.name)
            ? session.name
            : session.userId
        const at = createAccessToken(session.userId, participantName)
        const baseGrants = grantsForRole(isAdmin ? 'admin' : role, roomName)

        // Apply per-event permission overrides (non-admin/host users only)
        if (permGrant.canPublish !== undefined)        baseGrants.canPublish        = permGrant.canPublish
        if (permGrant.canPublishSources !== undefined) baseGrants.canPublishSources = permGrant.canPublishSources as unknown as TrackSource[]
        if (permGrant.canSubscribe !== undefined)      baseGrants.canSubscribe      = permGrant.canSubscribe
        at.addGrant(baseGrants)

        at.metadata = JSON.stringify({
            appUserId:          session.userId,
            preferredCaptionLang,
            role: isAdmin ? 'admin' : role,
        })

        const token = await at.toJwt()

        return NextResponse.json({
            token,
            wsUrl:    getLiveKitWsUrl(),
            roomName,
            identity: session.userId,
            role:     isAdmin ? 'admin' : role,
        })
    } catch (error) {
        console.error('[livekit/token] error', error instanceof Error ? error.message : error)
        const msg = error instanceof Error ? error.message : 'Internal server error'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
