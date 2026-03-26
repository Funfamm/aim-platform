/**
 * Simple in-memory rate limiter for API routes.
 * Tracks request counts per IP within a sliding time window.
 * 
 * Usage in any API route:
 *   import { rateLimit } from '@/lib/rate-limit'
 *   const limiter = rateLimit({ interval: 60_000, limit: 10 })
 *
 *   export async function POST(req: Request) {
 *       const blocked = limiter.check(req)
 *       if (blocked) return blocked  // Returns 429 Response
 *       // ... normal handler
 *   }
 */

interface RateLimitConfig {
    interval: number   // Time window in ms (e.g. 60_000 = 1 minute)
    limit: number      // Max requests per interval
}

interface TokenBucket {
    count: number
    lastReset: number
}

export function rateLimit({ interval, limit }: RateLimitConfig) {
    const buckets = new Map<string, TokenBucket>()

    // Cleanup old entries every 5 minutes to prevent memory leak
    setInterval(() => {
        const now = Date.now()
        for (const [key, bucket] of buckets) {
            if (now - bucket.lastReset > interval * 2) {
                buckets.delete(key)
            }
        }
    }, 5 * 60_000)

    return {
        check(req: Request): Response | null {
            const forwarded = req.headers.get('x-forwarded-for')
            const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
            const now = Date.now()

            let bucket = buckets.get(ip)
            if (!bucket || now - bucket.lastReset > interval) {
                bucket = { count: 0, lastReset: now }
                buckets.set(ip, bucket)
            }

            bucket.count++

            if (bucket.count > limit) {
                const retryAfter = Math.ceil((bucket.lastReset + interval - now) / 1000)
                return new Response(
                    JSON.stringify({ error: 'Too many requests. Please try again later.' }),
                    {
                        status: 429,
                        headers: {
                            'Content-Type': 'application/json',
                            'Retry-After': String(retryAfter),
                            'X-RateLimit-Limit': String(limit),
                            'X-RateLimit-Remaining': '0',
                        },
                    }
                )
            }

            return null // Not rate limited
        }
    }
}

// Pre-configured limiters for common use cases
export const authLimiter = rateLimit({ interval: 60_000, limit: 10 })      // 10 attempts/min
export const uploadLimiter = rateLimit({ interval: 60_000, limit: 5 })     // 5 uploads/min  
export const apiLimiter = rateLimit({ interval: 60_000, limit: 60 })       // 60 req/min general

// Refresh token endpoint limiter – 5 requests per minute
export const refreshLimiter = rateLimit({ interval: 60_000, limit: 5 }) // 5 req/min
export const aiLimiter = rateLimit({ interval: 60_000, limit: 3 })         // 3 AI calls/min
