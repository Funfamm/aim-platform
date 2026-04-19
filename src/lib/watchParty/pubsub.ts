/**
 * Watch Party — Redis Pub/Sub & State Layer
 * --------------------------------------------------------------------------
 * Uses the existing `redis` package (Upstash via REDIS_URL) to provide:
 *   - Authoritative playback state (Redis hash)
 *   - Live event fan-out (Redis Pub/Sub channel)
 *   - Viewer presence tracking (Redis key with TTL heartbeat)
 *
 * Redis Pub/Sub is at-most-once delivery. Missed messages during disconnect
 * are NOT replayed. On reconnect, clients read the state hash for current
 * authoritative position instead.
 *
 * Environment: REDIS_URL must be set (Upstash rediss:// URL).
 */

import { createClient } from 'redis'

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

// ── Key helpers ────────────────────────────────────────────────────────────

const stateKey    = (roomName: string) => `watch-party:state:${roomName}`
const channelKey  = (roomName: string) => `watch-party:${roomName}`
const presenceKey = (roomName: string, userId: string) =>
    `watch-party:presence:${roomName}:${userId}`
const presencePrefix = (roomName: string) => `watch-party:presence:${roomName}:*`

// ── Client singletons ──────────────────────────────────────────────────────
// We use two clients: one for publishing/state operations, one per subscriber
// (Redis SUBSCRIBE mode requires a dedicated connection per channel).

type RedisClient = ReturnType<typeof createClient>

let _pub: RedisClient | null = null

async function getPublisher(): Promise<RedisClient | null> {
    if (!process.env.REDIS_URL) return null
    if (_pub) return _pub
    _pub = createClient({ url: process.env.REDIS_URL })
    _pub.on('error', (err) => console.error('[watchParty/pubsub] pub error:', err))
    
    // Add 5s timeout to prevent hanging on unreachable hosts
    await Promise.race([
        _pub.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connection timeout')), 5000))
    ]).catch(err => {
        console.error('[watchParty/pubsub] connect failed:', err.message)
        _pub = null // Reset so it can retry on next call
        throw err
    })
    
    return _pub
}

/** Create a fresh subscriber client (must not share with publisher). */
async function createSubscriber(): Promise<RedisClient | null> {
    if (!process.env.REDIS_URL) return null
    const sub = createClient({ url: process.env.REDIS_URL })
    sub.on('error', (err) => console.error('[watchParty/pubsub] sub error:', err))
    
    await Promise.race([
        sub.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connection timeout')), 5000))
    ]).catch(err => {
        console.error('[watchParty/pubsub] sub connect failed:', err.message)
        throw err
    })
    
    return sub
}

// ── Playback state (Redis hash) ────────────────────────────────────────────

/** Read the current authoritative playback state. Returns null if not yet set
 *  (e.g. after server restart or first launch of a new event). */
export async function getPlaybackState(
    roomName: string,
): Promise<PlaybackState | null> {
    const pub = await getPublisher()
    if (!pub) return null
    const raw = await pub.hGetAll(stateKey(roomName))
    if (!raw || Object.keys(raw).length === 0) return null
    return {
        playing:        raw.playing === 'true',
        currentTimeSec: parseFloat(raw.currentTimeSec ?? '0'),
        status:         (raw.status as WatchPartyStatus) ?? 'lobby',
        lastUpdatedAt:  raw.lastUpdatedAt ?? new Date().toISOString(),
    }
}

/** Write the current authoritative playback state. */
export async function setPlaybackState(
    roomName: string,
    state: PlaybackState,
): Promise<void> {
    const pub = await getPublisher()
    if (!pub) return
    await pub.hSet(stateKey(roomName), {
        playing:        String(state.playing),
        currentTimeSec: String(state.currentTimeSec),
        status:         state.status,
        lastUpdatedAt:  state.lastUpdatedAt,
    })
    // Keep state alive for 24 hours (auto-cleanup for ended events)
    await pub.expire(stateKey(roomName), 60 * 60 * 24)
}

// ── Pub/Sub fan-out ────────────────────────────────────────────────────────

/** Publish a playback event to all connected viewers. */
export async function publishPlaybackEvent(
    roomName: string,
    event: WatchPartyEvent,
): Promise<void> {
    const pub = await getPublisher()
    if (!pub) return
    await pub.publish(channelKey(roomName), JSON.stringify(event))
}

/**
 * Subscribe to a room's event channel.
 * Returns a cleanup function — call it on disconnect/unmount.
 *
 * NOTE: Creates a dedicated subscriber client (cannot reuse the publisher).
 */
export async function subscribeToRoom(
    roomName: string,
    onMessage: (event: WatchPartyEvent) => void,
): Promise<(() => Promise<void>) | null> {
    const sub = await createSubscriber()
    if (!sub) return null

    await sub.subscribe(channelKey(roomName), (raw) => {
        try {
            const parsed = JSON.parse(raw) as WatchPartyEvent
            onMessage(parsed)
        } catch {
            console.warn('[watchParty/pubsub] bad message:', raw)
        }
    })

    return async () => {
        try {
            await sub.unsubscribe(channelKey(roomName))
            await sub.disconnect()
        } catch {
            // Ignore cleanup errors
        }
    }
}

// ── Presence tracking ──────────────────────────────────────────────────────
// Pattern: watch-party:presence:{roomName}:{userId} = "1" with 35s TTL
// Client heartbeats every 20s to refresh the TTL.
// Stale clients expire automatically — no explicit "leave" event needed.

const PRESENCE_TTL_SECONDS = 35

/** Refresh a viewer's presence TTL. Call every 20 seconds from the client. */
export async function heartbeatPresence(
    roomName: string,
    userId: string,
): Promise<void> {
    const pub = await getPublisher()
    if (!pub) return
    await pub.set(presenceKey(roomName, userId), '1', { EX: PRESENCE_TTL_SECONDS })
}

/** Count currently active viewers by scanning presence keys. */
export async function getPresenceCount(roomName: string): Promise<number> {
    const pub = await getPublisher()
    if (!pub) return 0
    // Use raw SCAN command for redis v5 compatibility
    let cursor = '0'
    let count  = 0
    const pattern = presencePrefix(roomName)
    do {
        const reply = await pub.scan(cursor, { MATCH: pattern, COUNT: 100 })
        cursor = String(reply.cursor)
        count += reply.keys.length
    } while (cursor !== '0')
    return count
}
