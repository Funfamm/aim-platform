/**
 * Live Event Analytics — logLiveEventAnalytic()
 * --------------------------------------------------------------------------
 * Fire-and-forget helper. Writes a LiveEventAnalyticEvent row.
 * Never throws. Safe to call anywhere — DB failures are logged and swallowed.
 *
 * IMPORTANT: joined_room fires on ACTUAL LiveKit connection, not token issuance.
 * Token minting alone does not constitute participation.
 *
 * Full taxonomy:
 *
 * Watch Party:
 *   invite_sent | invite_opened | invite_accepted
 *   joined_lobby | entered_playback
 *   playback_25 | playback_50 | playback_90 | completed
 *   left_early | rejoined | replay_started
 *   chat_sent | reaction_sent
 *
 * LiveKit (General / Audition / Q&A):
 *   joined_room | left_room
 *   camera_enabled | mic_enabled | screenshare_started
 *   chat_sent | reaction_sent | permission_updated
 */

import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

// ── Taxonomy types ─────────────────────────────────────────────────────────

export type WatchPartyAnalyticName =
    | 'invite_sent'
    | 'invite_opened'
    | 'invite_accepted'
    | 'joined_lobby'
    | 'entered_playback'
    | 'playback_25'
    | 'playback_50'
    | 'playback_90'
    | 'completed'
    | 'left_early'
    | 'rejoined'
    | 'replay_started'
    | 'chat_sent'
    | 'reaction_sent'

export type LiveKitAnalyticName =
    | 'joined_room'
    | 'left_room'
    | 'camera_enabled'
    | 'mic_enabled'
    | 'screenshare_started'
    | 'permission_updated'

export type LiveEventAnalyticName = WatchPartyAnalyticName | LiveKitAnalyticName

// ── Core helper ────────────────────────────────────────────────────────────

/**
 * Write an analytics event. Fire-and-forget — never throws.
 *
 * @param eventId  LiveEvent.id (not roomName)
 * @param userId   Authenticated user ID, or null for anonymous
 * @param name     Event name from the taxonomy above
 * @param metadata Optional structured payload
 */
export async function logLiveEventAnalytic(
    eventId:   string,
    userId:    string | null,
    name:      LiveEventAnalyticName,
    metadata?: Record<string, unknown>,
): Promise<void> {
    try {
        await prisma.liveEventAnalyticEvent.create({
            data: {
                eventId,
                userId:   userId ?? undefined,
                name,
                metadata: metadata as Prisma.InputJsonValue ?? Prisma.DbNull,
            },
        })
    } catch (err) {
        // Analytics failure must never affect the user experience
        console.warn('[liveEvent/analytics] write failed:', name, err)
    }
}

// ── Convenience wrappers ───────────────────────────────────────────────────

/** Resolve event.id from roomName and log. Useful in API routes that have
 *  roomName but not the DB primary key. */
export async function logAnalyticByRoomName(
    roomName: string,
    userId:   string | null,
    name:     LiveEventAnalyticName,
    metadata?: Record<string, unknown>,
): Promise<void> {
    try {
        const event = await prisma.liveEvent.findUnique({
            where:  { roomName },
            select: { id: true },
        })
        if (!event) return
        await logLiveEventAnalytic(event.id, userId, name, metadata)
    } catch {
        // Silently ignore
    }
}
