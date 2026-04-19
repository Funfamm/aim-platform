import LRU from 'lru-cache';
import { NextResponse } from 'next/server';
import { Redis as UpstashRedis } from '@upstash/redis'

// ── In-memory fallback (used when Upstash is not configured) ──────────────────────
const options = {
  max: 5000,
  ttl: 1000 * 60 * 60, // 1 hour
};
const submissionCache = new LRU<string, number[]>(options);

// ── Upstash REST client (no persistent TCP connection — serverless safe) ─────
let _redis: UpstashRedis | null = null

function getRedisSync(): UpstashRedis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  if (_redis) return _redis
  _redis = new UpstashRedis({ url, token })
  return _redis
}

async function getRedis() {
  return getRedisSync()
}

/**
 * Rate-limit casting submissions.
 * Strategy:
 *   - With REDIS_URL: atomic INCR + EXPIRE per key (cross-instance safe)
 *   - Without REDIS_URL: in-memory LRU sliding-window (single-instance only)
 * Allows CASTING_RATE_LIMIT submissions per hour per user/IP.
 * Returns a NextResponse with 429 when limit exceeded, otherwise null.
 */
export async function rateLimitCasting(request: Request): Promise<NextResponse | null> {
  const limit = Number(process.env.CASTING_RATE_LIMIT) || 5;

  // Identify caller — prefer authenticated user ID, fallback to IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('client-ip')
    || '';
  const userId = (request as Request & { user?: { id?: string } }).user?.id
  const key = `rl:casting:${userId ?? ip}`;

  if (!userId && !ip) return null; // No identifier — allow

  // ── Redis path ────────────────────────────────────────────────────────────
  const redis = await getRedis()
  if (redis) {
    try {
      // Upstash REST: INCR key; EXPIRE if new
      const count = await redis.incr(key)
      if (count === 1) {
        await redis.expire(key, 3600)
      }
      if (count > limit) {
        const ttl = await redis.ttl(key)
        return NextResponse.json(
          { error: 'Rate limit exceeded', limit, retryAfterSeconds: ttl },
          { status: 429, headers: { 'Retry-After': String(ttl) } }
        )
      }
      return null
    } catch (err) {
      console.warn('[rateLimitCasting] Upstash operation failed, falling back:', err)
    }
  }

  // ── In-memory fallback ────────────────────────────────────────────────────
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const timestamps = (submissionCache.get(key) ?? []).filter((t) => t > oneHourAgo);

  if (timestamps.length >= limit) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', limit, period: '1 hour' },
      { status: 429 }
    );
  }

  timestamps.push(now);
  submissionCache.set(key, timestamps);
  return null;
}
