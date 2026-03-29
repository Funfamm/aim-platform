import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { NextResponse, NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { CSRF_COOKIE_NAME, generateCsrfToken, setCsrfCookie, verifyCsrfToken } from './lib/csrf'

const intlMiddleware = createMiddleware(routing)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Admin API guard — runs before i18n routing
  // GET requests to /api/admin/media and /api/admin/videos are public —
  // they serve hero videos and page media to public-facing pages.
  // The route handlers themselves enforce admin-only access for write operations
  // and for the full dataset (via the ?admin=true param + requireAdmin() check).
  const isPublicMediaRead =
    request.method === 'GET' &&
    (pathname === '/api/admin/media' || pathname === '/api/admin/videos')

  if (!isPublicMediaRead && pathname.startsWith('/api/admin')) {
    const token = request.cookies.get('user_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    try {
      const secret = new TextEncoder().encode(
        process.env.JWT_SECRET || '__dev-only-secret-do-not-use-in-production__'
      )
      const { payload } = await jwtVerify(token, secret)
      if (payload.role !== 'admin' && payload.role !== 'superadmin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ═══ CSRF VERIFICATION ═══
    // Verify CSRF token on all state-changing admin API requests
    const csrfError = verifyCsrfToken(request)
    if (csrfError) return csrfError

    // Admin token valid — pass through without i18n processing
    const response = NextResponse.next()
    ensureCsrfCookie(request, response)
    return response
  }

  // Auth API routes — exempt from CSRF (login, register, OAuth need to work without it)
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Other API routes (public) — no CSRF needed but set cookie for future use
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next()
    ensureCsrfCookie(request, response)
    return response
  }

  // Admin panel routes — skip next-intl entirely so it cannot
  // rewrite or redirect /admin/* paths
  if (pathname.startsWith('/admin')) {
    const response = NextResponse.next()
    ensureCsrfCookie(request, response)
    return response
  }

  // All other routes — apply i18n middleware
  const response = intlMiddleware(request)
  // Ensure CSRF cookie is set on page navigations too
  if (response instanceof NextResponse) {
    ensureCsrfCookie(request, response)
  }
  return response
}

/**
 * Set a CSRF cookie if one doesn't already exist on the request.
 */
function ensureCsrfCookie(request: NextRequest, response: NextResponse) {
  const existing = request.cookies.get(CSRF_COOKIE_NAME)?.value
  if (!existing) {
    setCsrfCookie(response, generateCsrfToken())
  }
}

export const config = {
  // Match all routes EXCEPT static files and _next internals
  matcher: [
    '/((?!_next|_vercel|.*\\..*).*)',
    '/api/:path*',
  ],
}

