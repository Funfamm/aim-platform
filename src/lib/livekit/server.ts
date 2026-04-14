import { AccessToken, RoomServiceClient, EgressClient } from 'livekit-server-sdk'

function requireEnv(name: string): string {
    const val = process.env[name]
    if (!val) throw new Error(`Missing required env var: ${name}`)
    return val
}

export function getLiveKitConfig() {
    return {
        url: requireEnv('LIVEKIT_URL'),
        apiKey: requireEnv('LIVEKIT_API_KEY'),
        apiSecret: requireEnv('LIVEKIT_API_SECRET'),
    }
}

/** Create a short-lived access token for a participant. */
export function createAccessToken(identity: string, name: string) {
    const { apiKey, apiSecret } = getLiveKitConfig()
    return new AccessToken(apiKey, apiSecret, {
        identity,
        name,
        ttl: '10m',
    })
}

/** RoomServiceClient for server-side room management (create, end, list). */
export function getRoomServiceClient() {
    const { url, apiKey, apiSecret } = getLiveKitConfig()
    // RoomServiceClient needs HTTP(S) URL, not WSS
    const httpUrl = url.replace(/^wss?:\/\//, 'https://')
    return new RoomServiceClient(httpUrl, apiKey, apiSecret)
}

/** EgressClient for recording and streaming control (start, stop, list). */
export function getEgressClient() {
    const { url, apiKey, apiSecret } = getLiveKitConfig()
    const httpUrl = url.replace(/^wss?:\/\//, 'https://')
    return new EgressClient(httpUrl, apiKey, apiSecret)
}
