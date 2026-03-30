import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { NextResponse, NextRequest } from 'next/server'
import { CSRF_COOKIE_NAME, generateCsrfToken, setCsrfCookie, verifyCsrfToken } from './lib/csrf'

const intlMiddleware = createMiddleware(routing)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Admin API routes — pass through to route handlers which do their own requireAdmin() check
  // (getSession() supports refresh token renewal; the old middleware check did not)
  if (pathname.startsWith('/api/admin')) {
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

