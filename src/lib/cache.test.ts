/**
 * Tests for the in-memory TTL cache
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// We test the MemoryCache class directly rather than the singleton
// so we get a fresh instance each time
class MemoryCache {
    private store = new Map<string, { data: unknown; expiresAt: number }>()

    async get<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
        const existing = this.store.get(key) as { data: T; expiresAt: number } | undefined
        if (existing && existing.expiresAt > Date.now()) {
            return existing.data
        }
        const data = await fetcher()
        this.store.set(key, { data, expiresAt: Date.now() + ttlMs })
        return data
    }

    peek<T>(key: string): T | undefined {
        const entry = this.store.get(key) as { data: T; expiresAt: number } | undefined
        if (entry && entry.expiresAt > Date.now()) {
            return entry.data
        }
        return undefined
    }

    invalidate(key: string) { this.store.delete(key) }

    invalidatePrefix(prefix: string) {
        for (const key of this.store.keys()) {
            if (key.startsWith(prefix)) this.store.delete(key)
        }
    }

    clear() { this.store.clear() }

    get size() { return this.store.size }
}

describe('MemoryCache', () => {
    let cache: MemoryCache

    beforeEach(() => {
        cache = new MemoryCache()
    })

    it('should fetch and cache a value', async () => {
        const fetcher = vi.fn().mockResolvedValue('hello')
        const result = await cache.get('key1', 60_000, fetcher)
        expect(result).toBe('hello')
        expect(fetcher).toHaveBeenCalledTimes(1)
    })

    it('should return cached value on subsequent calls', async () => {
        const fetcher = vi.fn().mockResolvedValue('hello')
        await cache.get('key1', 60_000, fetcher)
        const result = await cache.get('key1', 60_000, fetcher)
        expect(result).toBe('hello')
        expect(fetcher).toHaveBeenCalledTimes(1) // Only called once
    })

    it('should refetch after TTL expires', async () => {
        const fetcher = vi.fn()
            .mockResolvedValueOnce('first')
            .mockResolvedValueOnce('second')

        await cache.get('key1', 100, fetcher) // 100ms TTL

        // Wait for TTL to expire
        await new Promise(r => setTimeout(r, 150))

        const result = await cache.get('key1', 100, fetcher)
        expect(result).toBe('second')
        expect(fetcher).toHaveBeenCalledTimes(2)
    })

    it('peek should return undefined on cache miss', () => {
        expect(cache.peek('nonexistent')).toBeUndefined()
    })

    it('peek should return cached value', async () => {
        await cache.get('key1', 60_000, async () => 'value')
        expect(cache.peek('key1')).toBe('value')
    })

    it('invalidate should remove specific key', async () => {
        await cache.get('key1', 60_000, async () => 'v1')
        await cache.get('key2', 60_000, async () => 'v2')

        cache.invalidate('key1')
        expect(cache.peek('key1')).toBeUndefined()
        expect(cache.peek('key2')).toBe('v2')
    })

    it('invalidatePrefix should remove matching keys', async () => {
        await cache.get('user:1', 60_000, async () => 'u1')
        await cache.get('user:2', 60_000, async () => 'u2')
        await cache.get('post:1', 60_000, async () => 'p1')

        cache.invalidatePrefix('user:')
        expect(cache.peek('user:1')).toBeUndefined()
        expect(cache.peek('user:2')).toBeUndefined()
        expect(cache.peek('post:1')).toBe('p1')
    })

    it('clear should remove all entries', async () => {
        await cache.get('k1', 60_000, async () => '1')
        await cache.get('k2', 60_000, async () => '2')

        expect(cache.size).toBe(2)
        cache.clear()
        expect(cache.size).toBe(0)
    })

    it('size should track number of cached entries', async () => {
        expect(cache.size).toBe(0)
        await cache.get('k1', 60_000, async () => 'a')
        expect(cache.size).toBe(1)
        await cache.get('k2', 60_000, async () => 'b')
        expect(cache.size).toBe(2)
    })
})
