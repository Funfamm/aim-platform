import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { generateCsrfToken, setCsrfCookie, CSRF_COOKIE_NAME } from './lib/csrf';
import { getSecurityHeaders } from './lib/security';

// next-intl locale routing middleware
const intlMiddleware = createMiddleware(routing);

/** Apply every security header from the centralised helper */
function applySecurityHeaders(response: NextResponse): NextResponse {
  const headers = getSecurityHeaders();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes: security headers only, skip locale handling & CSRF cookie
  if (pathname.startsWith('/api')) {
    const response = NextResponse.next();
    return applySecurityHeaders(response);
  }

  // Admin routes: skip locale handling (admin is NOT under [locale])
  if (pathname.startsWith('/admin')) {
    const existing = request.cookies.get(CSRF_COOKIE_NAME)?.value;
    const response = NextResponse.next();
    if (!existing) setCsrfCookie(response, generateCsrfToken());
    return applySecurityHeaders(response);
  }

  // All other routes: next-intl locale detection + CSRF cookie + security headers
  const existing = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const response = intlMiddleware(request);
  if (!existing) setCsrfCookie(response, generateCsrfToken());
  return applySecurityHeaders(response);
}

export const config = {
  // Apply middleware to all routes except Next.js internals and static files
  matcher: [
    '/((?!_next/static|_next/image|favicon|icons|images|manifest|sw\\.js|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff2?|ttf|eot)).*)',
  ],
};

