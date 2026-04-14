import { prisma } from '@/lib/db'
import type { LiveKitRole } from './grants'

/**
 * Checks whether a user is authorized to join a LiveKit room with a given role.
 *
 * Access rules:
 * - Platform admins (isAdmin=true) can join ANY room in ANY role
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
    // Platform admins bypass all room-level checks
    if (isAdmin) return { allowed: true }

    const event = await prisma.liveEvent.findUnique({
        where: { roomName },
        select: {
            status: true,
            eventType: true,
            hostUserId: true,
            castingCallId: true,
        },
    })

    if (!event) return { allowed: false, reason: 'Room not found' }
    if (event.status === 'ended') return { allowed: false, reason: 'Event has ended' }

    // ── Premium private audition rooms ──
    // Only the applicant who applied to the linked casting call may enter.
    if (event.eventType === 'audition' && event.castingCallId) {
        const application = await prisma.application.findFirst({
            where: {
                castingCallId: event.castingCallId,
                userId,
            },
            select: { id: true },
        })
        if (!application) {
            return { allowed: false, reason: 'You are not the applicant for this audition room' }
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
