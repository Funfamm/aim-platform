/**
 * Outreach Test-Send API — Unit Tests
 *
 * Tests the validation logic and rate-limiting extracted from
 * POST /api/admin/announcements/test.
 *
 * Since the route depends on Next.js Request/Response and Prisma,
 * we test the extracted pure functions in isolation.
 */
import { describe, it, expect } from 'vitest'

// ── Reproduce validation helpers from the route ─────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateEmail(email: string): boolean {
    return EMAIL_RE.test(email)
}

function validateCtaUrl(url: string | undefined): boolean {
    if (!url) return true // empty is valid (optional)
    return /^(\/|https:\/\/)/.test(url)
}

// ── Reproduce rate limiter from the route ───────────────────────────────────

const RATE_WINDOW_MS = 60_000
const RATE_MAX = 5

function createRateLimiter() {
    const buckets = new Map<string, number[]>()

    return {
        check(adminId: string, now = Date.now()): boolean {
            const bucket = buckets.get(adminId)?.filter(ts => now - ts < RATE_WINDOW_MS) ?? []
            buckets.set(adminId, bucket)
            if (bucket.length >= RATE_MAX) return false
            bucket.push(now)
            return true
        },
        reset() {
            buckets.clear()
        },
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL VALIDATION
// ═══════════════════════════════════════════════════════════════════════════
describe('Test-Send Email Validation', () => {
    it('should accept a valid email', () => {
        expect(validateEmail('admin@example.com')).toBe(true)
    })

    it('should accept email with subdomains', () => {
        expect(validateEmail('user@mail.example.co.uk')).toBe(true)
    })

    it('should reject email without @', () => {
        expect(validateEmail('notanemail')).toBe(false)
    })

    it('should reject email without domain', () => {
        expect(validateEmail('user@')).toBe(false)
    })

    it('should reject email with spaces', () => {
        expect(validateEmail('user @example.com')).toBe(false)
    })

    it('should reject empty string', () => {
        expect(validateEmail('')).toBe(false)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// CTA URL VALIDATION
// ═══════════════════════════════════════════════════════════════════════════
describe('Test-Send CTA URL Validation', () => {
    it('should accept undefined (optional)', () => {
        expect(validateCtaUrl(undefined)).toBe(true)
    })

    it('should accept empty string', () => {
        expect(validateCtaUrl('')).toBe(true)
    })

    it('should accept relative path', () => {
        expect(validateCtaUrl('/survey')).toBe(true)
    })

    it('should accept relative path with segments', () => {
        expect(validateCtaUrl('/admin/outreach?tab=results')).toBe(true)
    })

    it('should accept HTTPS URL', () => {
        expect(validateCtaUrl('https://example.com/page')).toBe(true)
    })

    it('should reject HTTP URL', () => {
        expect(validateCtaUrl('http://example.com')).toBe(false)
    })

    it('should reject javascript: URL (XSS vector)', () => {
        expect(validateCtaUrl('javascript:alert(1)')).toBe(false)
    })

    it('should reject data: URL', () => {
        expect(validateCtaUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    })

    it('should reject bare domain', () => {
        expect(validateCtaUrl('example.com')).toBe(false)
    })

    it('should reject ftp URL', () => {
        expect(validateCtaUrl('ftp://files.example.com')).toBe(false)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// RATE LIMITER
// ═══════════════════════════════════════════════════════════════════════════
describe('Test-Send Rate Limiter', () => {
    it('should allow first request', () => {
        const limiter = createRateLimiter()
        expect(limiter.check('admin1')).toBe(true)
    })

    it('should allow up to RATE_MAX requests', () => {
        const limiter = createRateLimiter()
        for (let i = 0; i < RATE_MAX; i++) {
            expect(limiter.check('admin1')).toBe(true)
        }
    })

    it('should reject the (RATE_MAX + 1)th request within the window', () => {
        const limiter = createRateLimiter()
        for (let i = 0; i < RATE_MAX; i++) {
            limiter.check('admin1')
        }
        expect(limiter.check('admin1')).toBe(false)
    })

    it('should track admins independently', () => {
        const limiter = createRateLimiter()
        for (let i = 0; i < RATE_MAX; i++) {
            limiter.check('admin1')
        }
        // admin2 should still be allowed
        expect(limiter.check('admin2')).toBe(true)
    })

    it('should allow requests after the window expires', () => {
        const limiter = createRateLimiter()
        const baseTime = Date.now()

        // Fill the bucket at baseTime
        for (let i = 0; i < RATE_MAX; i++) {
            limiter.check('admin1', baseTime)
        }
        expect(limiter.check('admin1', baseTime)).toBe(false)

        // Advance past the window
        const futureTime = baseTime + RATE_WINDOW_MS + 1
        expect(limiter.check('admin1', futureTime)).toBe(true)
    })

    it('should use sliding window — oldest entries expire first', () => {
        const limiter = createRateLimiter()
        const baseTime = Date.now()

        // Send 5 requests spaced 15s apart (0s, 15s, 30s, 45s, 60s)
        for (let i = 0; i < RATE_MAX; i++) {
            limiter.check('admin1', baseTime + i * 15_000)
        }

        // At 61s — the first request (at 0s) has expired, so one slot opens
        expect(limiter.check('admin1', baseTime + 61_000)).toBe(true)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// REQUIRED FIELDS
// ═══════════════════════════════════════════════════════════════════════════
describe('Test-Send Required Fields', () => {
    function validateRequired(body: { testEmail?: string; title?: string; message?: string }): string | null {
        if (!body.testEmail || !body.title?.trim() || !body.message?.trim()) {
            return 'testEmail, title, and message are required'
        }
        if (!EMAIL_RE.test(body.testEmail)) return 'Invalid email address format'
        return null
    }

    it('should reject when all fields missing', () => {
        expect(validateRequired({})).toBe('testEmail, title, and message are required')
    })

    it('should reject when title is empty', () => {
        expect(validateRequired({ testEmail: 'a@b.com', title: '', message: 'hi' })).toBe(
            'testEmail, title, and message are required'
        )
    })

    it('should reject when title is whitespace only', () => {
        expect(validateRequired({ testEmail: 'a@b.com', title: '   ', message: 'hi' })).toBe(
            'testEmail, title, and message are required'
        )
    })

    it('should reject when message is missing', () => {
        expect(validateRequired({ testEmail: 'a@b.com', title: 'Test' })).toBe(
            'testEmail, title, and message are required'
        )
    })

    it('should pass when all fields present', () => {
        expect(validateRequired({ testEmail: 'a@b.com', title: 'Test', message: 'Hello' })).toBeNull()
    })
})
