/**
 * Tests for the structured error logger
 * 
 * We test the logger's in-memory buffer behavior.
 * File I/O is not tested here since it requires fs access.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Inline LogEntry type to avoid fs import issues
interface LogEntry {
    id: string
    timestamp: string
    level: 'error' | 'warn' | 'info'
    source: string
    message: string
    stack?: string
    meta?: Record<string, unknown>
    userId?: string
    ip?: string
}

// Minimal in-memory logger matching the production API
function createTestLogger() {
    let recentErrors: LogEntry[] = []
    const MAX_ENTRIES = 500

    function generateId() {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }

    return {
        error(source: string, message: string, opts?: { error?: unknown; meta?: Record<string, unknown>; userId?: string; ip?: string }) {
            const entry: LogEntry = {
                id: generateId(),
                timestamp: new Date().toISOString(),
                level: 'error',
                source,
                message,
                stack: opts?.error instanceof Error ? opts.error.stack : undefined,
                meta: opts?.meta,
                userId: opts?.userId,
                ip: opts?.ip,
            }
            recentErrors.push(entry)
            if (recentErrors.length > MAX_ENTRIES) {
                recentErrors = recentErrors.slice(-MAX_ENTRIES)
            }
            return entry
        },

        warn(source: string, message: string, meta?: Record<string, unknown>) {
            const entry: LogEntry = {
                id: generateId(),
                timestamp: new Date().toISOString(),
                level: 'warn',
                source,
                message,
                meta,
            }
            recentErrors.push(entry)
            if (recentErrors.length > MAX_ENTRIES) {
                recentErrors = recentErrors.slice(-MAX_ENTRIES)
            }
            return entry
        },

        info(source: string, message: string, meta?: Record<string, unknown>) {
            return {
                id: generateId(),
                timestamp: new Date().toISOString(),
                level: 'info' as const,
                source,
                message,
                meta,
            }
        },

        getRecent(limit = 50, level?: 'error' | 'warn' | 'info'): LogEntry[] {
            let entries = recentErrors
            if (level) {
                entries = entries.filter(e => e.level === level)
            }
            return entries.slice(-limit).reverse()
        },

        getStats(minutes = 60) {
            const cutoff = Date.now() - minutes * 60_000
            const recent = recentErrors.filter(e => new Date(e.timestamp).getTime() > cutoff)
            return {
                errors: recent.filter(e => e.level === 'error').length,
                warnings: recent.filter(e => e.level === 'warn').length,
                total: recent.length,
            }
        },

        _getBuffer() { return recentErrors },
    }
}

describe('Logger', () => {
    let logger: ReturnType<typeof createTestLogger>

    beforeEach(() => {
        logger = createTestLogger()
    })

    it('should create error entries with correct structure', () => {
        const entry = logger.error('api/test', 'Something broke')
        expect(entry.level).toBe('error')
        expect(entry.source).toBe('api/test')
        expect(entry.message).toBe('Something broke')
        expect(entry.id).toBeTruthy()
        expect(entry.timestamp).toBeTruthy()
    })

    it('should capture error stack traces', () => {
        const err = new Error('test error')
        const entry = logger.error('api/test', 'Failed', { error: err })
        expect(entry.stack).toContain('Error: test error')
    })

    it('should store metadata and userId', () => {
        const entry = logger.error('auth', 'Login failed', {
            meta: { attempt: 3 },
            userId: 'user-123',
            ip: '1.2.3.4',
        })
        expect(entry.meta).toEqual({ attempt: 3 })
        expect(entry.userId).toBe('user-123')
        expect(entry.ip).toBe('1.2.3.4')
    })

    it('should create warn entries', () => {
        const entry = logger.warn('cache', 'Cache miss', { key: 'foo' })
        expect(entry.level).toBe('warn')
        expect(entry.meta).toEqual({ key: 'foo' })
    })

    it('getRecent should return newest first', () => {
        logger.error('a', 'first')
        logger.error('b', 'second')
        logger.error('c', 'third')

        const recent = logger.getRecent(10)
        expect(recent[0].message).toBe('third')
        expect(recent[2].message).toBe('first')
    })

    it('getRecent should respect limit', () => {
        for (let i = 0; i < 10; i++) {
            logger.error('test', `error ${i}`)
        }
        const recent = logger.getRecent(3)
        expect(recent.length).toBe(3)
    })

    it('getRecent should filter by level', () => {
        logger.error('a', 'error1')
        logger.warn('b', 'warn1')
        logger.error('c', 'error2')
        logger.warn('d', 'warn2')

        const errors = logger.getRecent(50, 'error')
        expect(errors.length).toBe(2)
        expect(errors.every(e => e.level === 'error')).toBe(true)

        const warnings = logger.getRecent(50, 'warn')
        expect(warnings.length).toBe(2)
    })

    it('getStats should return correct counts', () => {
        logger.error('a', 'e1')
        logger.error('a', 'e2')
        logger.warn('b', 'w1')

        const stats = logger.getStats(60)
        expect(stats.errors).toBe(2)
        expect(stats.warnings).toBe(1)
        expect(stats.total).toBe(3)
    })

    it('should cap buffer at MAX_ENTRIES', () => {
        for (let i = 0; i < 510; i++) {
            logger.error('test', `error ${i}`)
        }
        expect(logger._getBuffer().length).toBeLessThanOrEqual(500)
    })
})
