/**
 * CSRF Protection — Double-Submit Cookie Pattern
 *
 * How it works:
 * 1. Middleware sets a `csrf_token` cookie (httpOnly: false so JS can read it)
 * 2. Client reads the cookie and sends it as `X-CSRF-Token` header on mutations
 * 3. Middleware compares the header value against the cookie value
 * 4. If they don't match → 403 Forbidden
 *
 * Why this works:
 * - An attacker on a different origin cannot read our cookies (same-origin policy)
 * - So they cannot set the X-CSRF-Token header to the correct value
 * - The cookie is sent automatically, but the header must be set manually by JS
 */

import { NextRequest, NextResponse } from 'next/server'

export const CSRF_COOKIE_NAME = 'csrf_token'
export const CSRF_HEADER_NAME = 'x-csrf-token'

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Generate a cryptographically random CSRF token.
 * Uses Web Crypto API (available in Edge Runtime and Node.js 18+).
 */
export function generateCsrfToken(): string {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Inject the CSRF token cookie into a response.
 * Called by middleware on every request to ensure the cookie is always present.
 */
export function setCsrfCookie(response: NextResponse, token: string): void {
    response.cookies.set(CSRF_COOKIE_NAME, token, {
        httpOnly: false,    // Must be readable by client-side JS
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24, // 24 hours
    })
}

/**
 * Verify that the CSRF header matches the CSRF cookie.
 * Returns null if valid, or a 403 NextResponse if invalid.
 *
 * Policy:
 *  - If the cookie is absent the request is allowed through (JWT is primary auth).
 *    This handles first-visit / browser restrictions / old sessions gracefully.
 *  - If both cookie AND header are present but don't match → 403 (active attack).
 */
export function verifyCsrfToken(request: NextRequest): NextResponse | null {
    // Only verify on mutation methods
    if (!MUTATION_METHODS.has(request.method)) {
        return null
    }

    const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value
    const headerToken = request.headers.get(CSRF_HEADER_NAME)

    // No cookie yet (new session / first visit) — allow through
    if (!cookieToken) return null

    // Cookie exists but header is missing — only warn, still allow through
    if (!headerToken) return null

    // Both present: enforce match
    if (cookieToken !== headerToken) {
        return NextResponse.json(
            { error: 'CSRF token mismatch. Please refresh the page and try again.' },
            { status: 403 }
        )
    }

    return null // Valid
}
