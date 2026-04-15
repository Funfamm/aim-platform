import { AccessToken, RoomServiceClient, EgressClient } from 'livekit-server-sdk'

// ── Dev-time validation ──────────────────────────────────────────────────────
// Logs a clear warning on startup if any required LiveKit env var is missing.
// In production the first call to getLiveKitConfig() will throw, which surfaces
// as a 500 in the API response — so this is strictly an ergonomic dev helper.
if (process.env.NODE_ENV !== 'production') {
    ;(['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'] as const).forEach(k => {
        if (!process.env[k]) {
            console.warn(`[livekit/server] ⚠️  Missing env var: ${k}. Set it in .env.local`)
        }
    })
}

function requireEnv(name: string): string {
    const val = process.env[name]
    if (!val) throw new Error(`Missing required env var: ${name}. Add it to .env.local.`)
    return val
}

// ── URL normalisation helpers ────────────────────────────────────────────────
//
// LIVEKIT_URL may arrive in any of these forms from .env:
//   wss://my-app.livekit.cloud          ← LiveKit Cloud default
//   https://my-app.livekit.cloud        ← some console copy-paste flows
//   my-app.livekit.cloud                ← bare hostname (less common)
//
// RoomServiceClient / EgressClient need an  https://  base URL.
// LiveKitRoom (client-side)             needs a   wss://  WebSocket URL.
//
// These two helpers convert any of the above forms to the correct scheme,
// preventing the double-scheme bug (https://https://…) and the reverse
// (wss://wss://…) that caused silent connection failures.

function toHttpsUrl(raw: string): string {
    // Strip any existing scheme first, then add https://
    const stripped = raw.replace(/^(wss?|https?):(\/\/)?/, '')
    return `https://${stripped}`
}

function toWssUrl(raw: string): string {
    // Strip any existing scheme first, then add wss://
    const stripped = raw.replace(/^(wss?|https?):(\/\/)?/, '')
    return `wss://${stripped}`
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getLiveKitConfig() {
    return {
        /** HTTPS URL — for RoomServiceClient / EgressClient */
        url:       toHttpsUrl(requireEnv('LIVEKIT_URL')),
        /** WSS URL — for client-side LiveKitRoom component */
        wsUrl:     toWssUrl(requireEnv('LIVEKIT_URL')),
        apiKey:    requireEnv('LIVEKIT_API_KEY'),
        apiSecret: requireEnv('LIVEKIT_API_SECRET'),
    }
}

/**
 * Returns the wss:// WebSocket URL for use in the LiveKitRoom component.
 * Always derived from LIVEKIT_URL so server and client always point at the
 * same LiveKit instance.
 */
export function getLiveKitWsUrl(): string {
    return toWssUrl(requireEnv('LIVEKIT_URL'))
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
    return new RoomServiceClient(url, apiKey, apiSecret)
}

/** EgressClient for recording and streaming control (start, stop, list). */
export function getEgressClient() {
    const { url, apiKey, apiSecret } = getLiveKitConfig()
    return new EgressClient(url, apiKey, apiSecret)
}
