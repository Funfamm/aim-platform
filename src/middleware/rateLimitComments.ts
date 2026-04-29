import LRU from 'lru-cache'
import { NextResponse } from 'next/server'
import { Redis as UpstashRedis } from '@upstash/redis'

// ── In-memory fallback (used when Upstash is not configured) ──────────────────
const submissionCache = new LRU<string, number[]>({ max: 5000, ttl: 1000 * 60 * 60 })

// ── Upstash REST client ─────────────────────────────────────────────────────
let _redis: UpstashRedis | null = null
function getRedis(): UpstashRedis | null {
    const url   = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !token) return null
    if (_redis) return _redis
    _redis = new UpstashRedis({ url, token })
    return _redis
}

/**
 * Rate-limit comment submissions.
 * Keyed by authenticated userId — not IP, since posting requires auth.
 * Allows 5 comments per 60 seconds per user.
 */
export async function rateLimitComments(userId: string): Promise<NextResponse | null> {
    const limit = 5
    const windowSec = 60
    const key = `rl:comment:${userId}`

    // ── Redis path ──────────────────────────────────────────────────────────
    const redis = getRedis()
    if (redis) {
        try {
            const count = await redis.incr(key)
            if (count === 1) await redis.expire(key, windowSec)
            if (count > limit) {
                const ttl = await redis.ttl(key)
                return NextResponse.json(
                    { error: 'Too many comments. Please wait a moment.' },
                    { status: 429, headers: { 'Retry-After': String(ttl) } }
                )
            }
            return null
        } catch (err) {
            console.warn('[rateLimitComments] Upstash failed, falling back:', err)
        }
    }

    // ── In-memory fallback ──────────────────────────────────────────────────
    const now = Date.now()
    const windowMs = windowSec * 1000
    const timestamps = (submissionCache.get(key) ?? []).filter(t => t > now - windowMs)
    if (timestamps.length >= limit) {
        return NextResponse.json(
            { error: 'Too many comments. Please wait a moment.' },
            { status: 429 }
        )
    }
    timestamps.push(now)
    submissionCache.set(key, timestamps)
    return null
}

/**
 * Rate-limit comment like toggles.
 * Keyed by authenticated userId.
 * Allows 60 likes per 60 seconds per user.
 */
export async function rateLimitLikes(userId: string): Promise<NextResponse | null> {
    const limit = 60
    const windowSec = 60
    const key = `rl:like:${userId}`

    const redis = getRedis()
    if (redis) {
        try {
            const count = await redis.incr(key)
            if (count === 1) await redis.expire(key, windowSec)
            if (count > limit) {
                const ttl = await redis.ttl(key)
                return NextResponse.json(
                    { error: 'Too many requests. Please slow down.' },
                    { status: 429, headers: { 'Retry-After': String(ttl) } }
                )
            }
            return null
        } catch (err) {
            console.warn('[rateLimitLikes] Upstash failed, falling back:', err)
        }
    }

    const now = Date.now()
    const windowMs = windowSec * 1000
    const timestamps = (submissionCache.get(key) ?? []).filter(t => t > now - windowMs)
    if (timestamps.length >= limit) {
        return NextResponse.json(
            { error: 'Too many requests. Please slow down.' },
            { status: 429 }
        )
    }
    timestamps.push(now)
    submissionCache.set(key, timestamps)
    return null
}
