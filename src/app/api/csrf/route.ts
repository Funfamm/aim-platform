import { NextRequest, NextResponse } from 'next/server'
import { generateCsrfToken, setCsrfCookie, CSRF_COOKIE_NAME } from '@/lib/csrf'

/**
 * GET /api/csrf
 *
 * Lazy CSRF token issuance endpoint.
 *
 * Background
 * ──────────
 * The CSRF cookie was previously issued by middleware on every page response.
 * That Set-Cookie header prevented Vercel's edge CDN from caching ANY page
 * (CDN policy: any response with Set-Cookie is never cached).
 *
 * Fix: middleware no longer sets the CSRF cookie. Instead, AuthProvider
 * fetches this endpoint once on app mount (client-side useEffect). The
 * endpoint issues the cookie only if the browser doesn't already have one.
 *
 * Security properties are preserved:
 *  - Cookie is still httpOnly: false (JS-readable for double-submit pattern)
 *  - Cookie is still SameSite: lax + Secure in production
 *  - verifyCsrfToken() still enforces the match on mutations
 *  - The login route already sets a fresh token on successful authentication
 *  - The short window between page paint and this fetch completing is identical
 *    to the pre-existing "first-visit / no cookie" window verifyCsrfToken()
 *    already handles gracefully (it allows through if cookie is absent)
 *
 * This endpoint is intentionally unauthenticated — it provides no sensitive
 * data and calling it without a token is exactly the intended use case.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const existing = request.cookies.get(CSRF_COOKIE_NAME)?.value

    // If a valid token already exists, return it without touching the cookie.
    // This avoids unnecessary cookie churn on tab re-focus or SPA navigation.
    if (existing) {
        return NextResponse.json({ ok: true, fresh: false })
    }

    // No token yet — generate one and set it in the response cookie.
    const token = generateCsrfToken()
    const response = NextResponse.json({ ok: true, fresh: true })
    setCsrfCookie(response, token)
    return response
}
