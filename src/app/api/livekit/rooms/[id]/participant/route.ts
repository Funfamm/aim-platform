/**
 * PATCH /api/livekit/rooms/[id]/participant
 * --------------------------------------------------------------------------
 * Live participant permission update. Admin-only.
 *
 * Body: {
 *   participantIdentity: string          // userId used as LiveKit identity
 *   permissions: {
 *     camera?:      boolean
 *     mic?:         boolean
 *     screenShare?: boolean
 *   }
 * }
 *
 * Calls LiveKit's UpdateParticipant API. Connected clients automatically
 * receive a `participantPermissionsChanged` event from the LiveKit SDK.
 *
 * Note: `id` in the path is the LiveEvent.roomName (not the DB primary key)
 * for consistency with other room routes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { getRoomServiceClient } from '@/lib/livekit/server'
import { prisma } from '@/lib/db'
import { logLiveEventAnalytic } from '@/lib/liveEvent/analytics'

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = await getUserSession()
        if (!session?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const isAdmin = ['admin', 'superadmin'].includes(session.role ?? '')
        if (!isAdmin) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
        }

        const { id: roomName } = await params
        const body = await req.json() as {
            participantIdentity: string
            permissions: {
                camera?:      boolean
                mic?:         boolean
                screenShare?: boolean
            }
        }

        const { participantIdentity, permissions } = body

        if (!participantIdentity || !permissions) {
            return NextResponse.json({ error: 'participantIdentity and permissions are required' }, { status: 400 })
        }

        // Build permission sources (corrected canPublish logic — includes screenShare)
        const sources: string[] = [
            ...(permissions.camera      !== false ? ['camera']       : []),
            ...(permissions.mic         !== false ? ['microphone']   : []),
            ...(permissions.screenShare !== false ? ['screen_share'] : []),
        ]
        const canPublish = sources.length > 0

        const roomSvc = getRoomServiceClient()
        await roomSvc.updateParticipant(roomName, participantIdentity, undefined, {
            canPublish,
            canPublishSources: sources,
            canSubscribe: true,
        } as unknown as Parameters<typeof roomSvc.updateParticipant>[3])

        // Log analytics (fire-and-forget)
        try {
            const event = await prisma.liveEvent.findUnique({
                where:  { roomName },
                select: { id: true },
            })
            if (event) {
                await logLiveEventAnalytic(event.id, session.userId, 'permission_updated', {
                    targetIdentity: participantIdentity,
                    permissions,
                })
            }
        } catch { /* non-critical */ }

        return NextResponse.json({ ok: true, canPublish, sources })
    } catch (err) {
        console.error('[livekit/rooms/participant] PATCH error:', err)
        const msg = err instanceof Error ? err.message : 'Internal server error'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
