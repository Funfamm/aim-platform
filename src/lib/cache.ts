/**
 * In-Memory Cache with TTL
 *
 * A simple, zero-dependency cache for frequently accessed data.
 * Works without Redis — suitable for single-instance deployments.
 * Automatically cleans up expired entries to prevent memory leaks.
 */

interface CacheEntry<T> {
    data: T
    expiresAt: number
}

class MemoryCache {
    private store = new Map<string, CacheEntry<unknown>>()
    private cleanupInterval: ReturnType<typeof setInterval> | null = null

    constructor() {
        // Clean up expired entries every 60 seconds
        if (typeof setInterval !== 'undefined') {
            this.cleanupInterval = setInterval(() => this.cleanup(), 60_000)
            // Don't prevent process exit
            if (this.cleanupInterval?.unref) this.cleanupInterval.unref()
        }
    }

    /**
     * Get a value from cache, or compute it if missing/expired
     * @param key Cache key
     * @param ttlMs Time-to-live in milliseconds
     * @param fetcher Async function to compute the value if cache miss
     */
    async get<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
        const existing = this.store.get(key) as CacheEntry<T> | undefined

        if (existing && existing.expiresAt > Date.now()) {
            return existing.data
        }

        // Cache miss or expired — fetch fresh data
        const data = await fetcher()

        this.store.set(key, {
            data,
            expiresAt: Date.now() + ttlMs,
        })

        return data
    }

    /** Get cached value without fetching (returns undefined on miss) */
    peek<T>(key: string): T | undefined {
        const entry = this.store.get(key) as CacheEntry<T> | undefined
        if (entry && entry.expiresAt > Date.now()) {
            return entry.data
        }
        return undefined
    }

    /** Invalidate a specific key */
    invalidate(key: string) {
        this.store.delete(key)
    }

    /** Invalidate all keys matching a prefix */
    invalidatePrefix(prefix: string) {
        for (const key of this.store.keys()) {
            if (key.startsWith(prefix)) {
                this.store.delete(key)
            }
        }
    }

    /** Invalidate everything */
    clear() {
        this.store.clear()
    }

    /** Remove expired entries */
    private cleanup() {
        const now = Date.now()
        for (const [key, entry] of this.store.entries()) {
            if (entry.expiresAt <= now) {
                this.store.delete(key)
            }
        }
    }

    /** Current cache size (for monitoring) */
    get size() {
        return this.store.size
    }
}

// Singleton — shared across all requests in the same process
const globalForCache = globalThis as unknown as { __cache: MemoryCache }
export const cache = globalForCache.__cache || new MemoryCache()
if (process.env.NODE_ENV !== 'production') globalForCache.__cache = cache

// ── Pre-defined cache keys & TTLs ──────────────────────────────

export const CACHE_KEYS = {
    SITE_SETTINGS: 'site:settings',
    HOMEPAGE_STATS: 'home:stats',
    FEATURED_PROJECTS: 'home:featured',
    SPONSORS_ACTIVE: 'sponsors:active',
    CASTING_OPEN: 'casting:open_count',
} as const

export const CACHE_TTL = {
    SHORT: 30_000,        // 30 seconds — real-time-ish data
    MEDIUM: 2 * 60_000,   // 2 minutes — settings, counts
    LONG: 5 * 60_000,     // 5 minutes — rarely changing content
    VERY_LONG: 15 * 60_000, // 15 minutes — static-ish content
} as const
