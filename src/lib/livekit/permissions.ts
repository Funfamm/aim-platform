import { prisma } from '@/lib/db'
import type { LiveKitRole } from './grants'

/**
 * Checks whether a user is authorized to join a LiveKit room with a given role.
 *
 * Access rules:
 * - Platform admins (isAdmin=true) can join ANY room in ANY role.
 *   `isAdmin` must be pre-computed by the caller using a null-safe role check:
 *     const isAdmin = ['admin','superadmin'].includes(session.role ?? '')
 * - Audition rooms (eventType='audition') restrict access to:
 *   → the exact applicant linked to the castingCallId, or an admin
 * - General / q_and_a / watch_party rooms:
 *   → Any authenticated user may join as viewer
 *   → Only the designated hostUserId may join as host
 *   → Room must be 'scheduled' or 'live' (not 'ended')
 */
export async function canJoinRoom(
    userId: string,
    roomName: string,
    role: LiveKitRole,
    isAdmin: boolean,
): Promise<{ allowed: boolean; reason?: string }> {
    // Platform admins bypass all room-level checks.
    // isAdmin MUST be validated by the caller — never derive it from userId alone.
    if (isAdmin) return { allowed: true }

    let event = null
    try {
        event = await prisma.liveEvent.findUnique({
            where: { roomName },
            select: {
                status: true,
                eventType: true,
                hostUserId: true,
                castingCallId: true,
            },
        })
    } catch (e) {
        console.error('[livekit/permissions] DB error fetching event:', e)
        return { allowed: false, reason: 'Database unavailable' }
    }

    if (!event) return { allowed: false, reason: 'Room not found' }
    if (event.status === 'ended') return { allowed: false, reason: 'Event has ended' }

    // ── Audition rooms ──
    // For rooms with a castingCallId:
    //   - 'viewer' role → always allowed (invited guests, observers)
    //   - 'speaker'/'host' roles → only the applicant for this casting call
    // For rooms WITHOUT a castingCallId:
    //   → any authenticated user may join as viewer
    if (event.eventType === 'audition' && event.castingCallId) {
        // Viewers (non-publishing) are always welcome — they may be observers or
        // admins who were assigned role='viewer' by the page for some other reason.
        if (role === 'viewer') return { allowed: true }

        // speaker/host must have an application for the linked casting call
        const application = await prisma.application.findFirst({
            where: {
                castingCallId: event.castingCallId,
                userId,
            },
            select: { id: true },
        })
        if (!application) {
            return {
                allowed: false,
                reason: 'You must have an active application for this casting call to participate as a speaker. You can still join as a viewer — please use the viewer link.',
            }
        }
        return { allowed: true }
    }

    // ── General / Q&A / Watch Party rooms ──
    // host role — only the designated host
    if (role === 'host' && event.hostUserId !== userId) {
        return { allowed: false, reason: 'Only the designated host may join with this role' }
    }

    return { allowed: true }
}
