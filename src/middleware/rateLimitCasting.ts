import LRU from 'lru-cache';
import { NextResponse } from 'next/server';

// ── In-memory fallback (used when REDIS_URL is not set) ──────────────────────
const options = {
  max: 5000,
  ttl: 1000 * 60 * 60, // 1 hour
};
const submissionCache = new LRU<string, number[]>(options);

// ── Redis client (lazily initialised, reused across invocations) ──────────────
let _redis: import('redis').RedisClientType | null = null

async function getRedis() {
  if (!process.env.REDIS_URL) return null
  if (_redis) return _redis
  try {
    const { createClient } = await import('redis')
    const client = createClient({ url: process.env.REDIS_URL })
    await client.connect()
    client.on('error', (err) => console.error('[rateLimitCasting] Redis error:', err))
    _redis = client as import('redis').RedisClientType
    return _redis
  } catch (err) {
    console.warn('[rateLimitCasting] Redis connection failed — falling back to in-memory:', err)
    return null
  }
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
      const count = await redis.incr(key)
      if (count === 1) {
        // First request in window — set TTL of 1 hour
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
      // Redis is available but threw — fall through to in-memory
      console.warn('[rateLimitCasting] Redis operation failed, falling back:', err)
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
