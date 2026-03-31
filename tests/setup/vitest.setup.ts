/**
 * Vitest Global Setup
 *
 * Runs before every test file. Sets up:
 * - Environment variable defaults for testing
 * - Console noise suppression for expected errors
 */

// ── Env overrides for test isolation ────────────────────────────────
// NODE_ENV is already set to 'test' by Vitest — no need to override
process.env.JWT_SECRET = process.env.JWT_SECRET || '__test-secret-32-chars-minimum__'
process.env.NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// Suppress noisy expected-error logs in test output
const originalConsoleError = console.error
console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : ''
    // Skip expected error noise
    if (
        msg.includes('Graph token request failed') ||
        msg.includes('AZURE') ||
        msg.includes('NEXT_REDIRECT')
    ) {
        return
    }
    originalConsoleError.apply(console, args)
}

export {}
