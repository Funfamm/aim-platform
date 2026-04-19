/**
 * Watch Party — Upstash Redis State Layer
 * --------------------------------------------------------------------------
 * Uses @upstash/redis (HTTP-based REST client) which is compatible with
 * Vercel serverless functions. Unlike the `redis` npm package, Upstash
 * Redis does NOT require persistent TCP connections — every operation is
 * a single HTTPS fetch, making it safe for use in serverless environments.
 *
 * Architecture:
 *   - Playback state:  Redis hash (HSET/HGETALL)
 *   - SSE fan-out:     DB polling (see subscribe route) — NOT Redis Pub/Sub.
 *                      Redis pub/sub requires a persistent connection which
 *                      Vercel cannot hold open.
 *   - Viewer presence: Redis key with TTL (SET EX)
 *
 * Required environment variables:
 *   UPSTASH_REDIS_REST_URL  — e.g. https://your-db.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN — your Upstash REST token
 *
 * Legacy REDIS_URL is no longer used.
 */

import { Redis } from '@upstash/redis'

// ── Types ──────────────────────────────────────────────────────────────────

export type WatchPartyStatus = 'lobby' | 'playing' | 'paused' | 'ended'

export interface PlaybackState {
    playing:        boolean
    currentTimeSec: number
    status:         WatchPartyStatus
    lastUpdatedAt:  string // ISO timestamp
}

export type WatchPartyEventName =
    | 'sync'
    | 'lobby'
    | 'paused'
    | 'ended'
    | 'chat'
    | 'reaction'

export interface WatchPartyEvent {
    event:   WatchPartyEventName
    payload: Record<string, unknown>
}

// ── Client singleton ────────────────────────────────────────────────────────

function getRedis(): Redis | null {
    const url   = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !token) {
        // Not configured — watch party falls back to DB-only mode
        console.warn('[watchParty/pubsub] UPSTASH_REDIS_REST_URL / TOKEN not set. Watch party state will not persist across function invocations.')
        return null
    }
    return new Redis({ url, token })
}

// ── Key helpers ────────────────────────────────────────────────────────────

const stateKey    = (roomName: string) => `watch-party:state:${roomName}`
const presenceKey = (roomName: string, userId: string) =>
    `watch-party:presence:${roomName}:${userId}`
const presenceSet = (roomName: string) => `watch-party:presenceset:${roomName}`

// ── Playback state (Redis hash) ────────────────────────────────────────────

/** Read the current authoritative playback state. Returns null if not yet set. */
export async function getPlaybackState(
    roomName: string,
): Promise<PlaybackState | null> {
    const redis = getRedis()
    if (!redis) return null
    try {
        const raw = await redis.hgetall(stateKey(roomName))
        if (!raw || Object.keys(raw).length === 0) return null
        return {
            playing:        raw.playing === 'true',
            currentTimeSec: parseFloat((raw.currentTimeSec as string) ?? '0'),
            status:         (raw.status as WatchPartyStatus) ?? 'lobby',
            lastUpdatedAt:  (raw.lastUpdatedAt as string) ?? new Date().toISOString(),
        }
    } catch (err) {
        console.error('[watchParty/pubsub] getPlaybackState error:', err)
        return null
    }
}

/** Write the current authoritative playback state. */
export async function setPlaybackState(
    roomName: string,
    state: PlaybackState,
): Promise<void> {
    const redis = getRedis()
    if (!redis) return
    try {
        await redis.hset(stateKey(roomName), {
            playing:        String(state.playing),
            currentTimeSec: String(state.currentTimeSec),
            status:         state.status,
            lastUpdatedAt:  state.lastUpdatedAt,
        })
        // Keep state alive for 24 hours
        await redis.expire(stateKey(roomName), 60 * 60 * 24)
    } catch (err) {
        console.error('[watchParty/pubsub] setPlaybackState error:', err)
    }
}

// ── Pub/Sub stub ─────────────────────────────────────────────────────────────
// NOTE: Upstash REST does not support pub/sub. The SSE route uses DB polling
// instead of subscribing to a Redis channel. publishPlaybackEvent is kept for
// API compatibility but is a no-op — the SSE polling picks up changes from
// the state hash written by setPlaybackState.

/** No-op on Vercel — SSE route polls state hash directly. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function publishPlaybackEvent(
    _roomName: string,
    _event: WatchPartyEvent,
): Promise<void> {
    // SSE delivery is accomplished via state-hash polling in the subscribe route.
    // This function is intentionally empty.
}

// ── Presence tracking ──────────────────────────────────────────────────────
// Strategy: use a Redis sorted set (ZADD with score = unix timestamp) so we
// can count members scored within the last 35 seconds without SCAN.
// This is O(log N) instead of O(keys) and works great on Upstash.

const PRESENCE_TTL_SECONDS = 35

/** Refresh a viewer's presence. Call every 20 seconds from the client. */
export async function heartbeatPresence(
    roomName: string,
    userId: string,
): Promise<void> {
    const redis = getRedis()
    if (!redis) return
    try {
        const now = Math.floor(Date.now() / 1000)
        const setKey = presenceSet(roomName)
        await redis.zadd(setKey, { score: now, member: userId })
        // Expire the entire sorted set after 24h (auto-cleanup)
        await redis.expire(setKey, 60 * 60 * 24)
    } catch (err) {
        console.error('[watchParty/pubsub] heartbeatPresence error:', err)
    }
}

/** Count currently active viewers. */
export async function getPresenceCount(roomName: string): Promise<number> {
    const redis = getRedis()
    if (!redis) return 0
    try {
        const now = Math.floor(Date.now() / 1000)
        const cutoff = now - PRESENCE_TTL_SECONDS
        // Count members with score >= cutoff (active in last 35s)
        return await redis.zcount(presenceSet(roomName), cutoff, '+inf')
    } catch (err) {
        console.error('[watchParty/pubsub] getPresenceCount error:', err)
        return 0
    }
}
