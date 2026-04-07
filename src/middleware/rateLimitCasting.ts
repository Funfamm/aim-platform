import LRU from 'lru-cache';
import { NextResponse } from 'next/server';

// Cache key: userId or IP, value: array of timestamps (ms) of recent submissions
const options = {
  max: 5000, // max distinct keys
  ttl: 1000 * 60 * 60, // 1 hour TTL for each entry
};
const submissionCache = new LRU<string, number[]>(options);

/**
 * Rate‑limit casting submissions.
 * Allows CASTING_RATE_LIMIT submissions per hour per user/IP.
 * Returns a NextResponse with 429 when limit exceeded, otherwise null.
 */
export async function rateLimitCasting(request: Request): Promise<NextResponse | null> {
  const limit = Number(process.env.CASTING_RATE_LIMIT) || 5;
  const now = Date.now();

  // Identify caller – prefer authenticated user ID, fallback to IP
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('client-ip') || '';
  // In a real app you would extract userId from session/jwt; placeholder here
  const userId = (request as Request & { user?: { id?: string } }).user?.id
  const key = userId ?? ip;

  if (!key) {
    // No identifier – allow but log for monitoring
    return null;
  }

  const timestamps = submissionCache.get(key) ?? [];
  // Keep only timestamps within the last hour
  const oneHourAgo = now - 60 * 60 * 1000;
  const recent = timestamps.filter((t) => t > oneHourAgo);

  if (recent.length >= limit) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', limit, period: '1 hour' },
      { status: 429 }
    );
  }

  recent.push(now);
  submissionCache.set(key, recent);
  return null;
}
