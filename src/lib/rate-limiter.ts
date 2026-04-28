/**
 * Domain Rate Limiter
 * ---------------------------------------------------------------------------
 * In-memory rate limiter for outbound email to protect domain reputation
 * and prevent ESP throttling.
 *
 * Limits:
 *   - 500 emails per domain per hour
 *   - 200 total emails per minute (global)
 *
 * Each Vercel function invocation gets its own instance, but since the
 * email-worker cron processes at most 20 emails per run (60s interval),
 * the limits are designed to catch misconfigured loops, not normal operation.
 */
import { logger } from '@/lib/logger'

interface Counter {
    count: number
    resetAt: number
}

class DomainRateLimiter {
    private domainCounters: Map<string, Counter> = new Map()
    private totalLastMinute: Counter = { count: 0, resetAt: Date.now() + 60_000 }

    private readonly MAX_PER_DOMAIN_PER_HOUR = 500
    private readonly MAX_TOTAL_PER_MINUTE = 200

    /**
     * Check if an email can be sent to the given address.
     *
     * @returns { allowed: true } if under limits
     * @returns { allowed: false, retryAfterMs } if rate-limited
     */
    canSend(email: string): { allowed: boolean; retryAfterMs: number } {
        const domain = email.split('@')[1]?.toLowerCase()
        if (!domain) return { allowed: false, retryAfterMs: 60_000 }

        const now = Date.now()

        // ── Global per-minute cap ───────────────────────────────────────────
        if (now > this.totalLastMinute.resetAt) {
            this.totalLastMinute = { count: 0, resetAt: now + 60_000 }
        }
        if (this.totalLastMinute.count >= this.MAX_TOTAL_PER_MINUTE) {
            const retryAfterMs = Math.max(this.totalLastMinute.resetAt - now, 1_000)
            logger.warn('rate-limiter', `Global rate limit hit (${this.MAX_TOTAL_PER_MINUTE}/min), retry in ${retryAfterMs}ms`)
            return { allowed: false, retryAfterMs }
        }

        // ── Per-domain hourly cap ───────────────────────────────────────────
        const entry = this.domainCounters.get(domain)
        if (!entry || now > entry.resetAt) {
            // New window or expired window
            this.domainCounters.set(domain, { count: 1, resetAt: now + 3_600_000 })
        } else {
            if (entry.count >= this.MAX_PER_DOMAIN_PER_HOUR) {
                const retryAfterMs = Math.max(entry.resetAt - now, 1_000)
                logger.warn('rate-limiter', `Domain rate limit hit for ${domain} (${this.MAX_PER_DOMAIN_PER_HOUR}/hr), retry in ${retryAfterMs}ms`)
                return { allowed: false, retryAfterMs }
            }
            entry.count++
        }

        this.totalLastMinute.count++
        return { allowed: true, retryAfterMs: 0 }
    }

    /**
     * Periodic cleanup of expired domain counters.
     * Call this periodically to prevent unbounded memory growth.
     */
    cleanup(): void {
        const now = Date.now()
        for (const [domain, entry] of this.domainCounters) {
            if (now > entry.resetAt) {
                this.domainCounters.delete(domain)
            }
        }
    }
}

/** Singleton rate limiter instance */
export const domainRateLimiter = new DomainRateLimiter()
