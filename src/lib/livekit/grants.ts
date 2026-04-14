import type { VideoGrant } from 'livekit-server-sdk'

export type LiveKitRole = 'admin' | 'host' | 'speaker' | 'viewer'

/**
 * Returns the minimal LiveKit VideoGrant for a given role.
 *
 * admin   — full room admin + publish + subscribe
 * host    — publish + subscribe, no room admin
 * speaker — publish + subscribe (same as host, semantic difference)
 * viewer  — subscribe only, cannot publish audio/video/data
 */
export function grantsForRole(role: LiveKitRole, roomName: string): VideoGrant {
    const base: VideoGrant = {
        roomJoin: true,
        room: roomName,
        canSubscribe: true,
    }

    if (role === 'admin') {
        return {
            ...base,
            canPublish: true,
            canPublishData: true,
            roomAdmin: true,
            roomRecord: true,
        }
    }

    if (role === 'host' || role === 'speaker') {
        return {
            ...base,
            canPublish: true,
            canPublishData: true,
        }
    }

    // viewer — subscribe only
    return {
        ...base,
        canPublish: false,
        canPublishData: false,
    }
}
