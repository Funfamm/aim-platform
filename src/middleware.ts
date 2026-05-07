import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';
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
  // ── Canonical domain: www → non-www (308 permanent) ──────────────────────
  // Must be first — before locale routing, CSRF, or any cookie logic.
  // Prevents OAuth state-cookie mismatches when users arrive on www.*
  const host = request.headers.get('host') || ''
  if (host.startsWith('www.')) {
    const canonical = `https://impactaistudio.com${request.nextUrl.pathname}${request.nextUrl.search}`
    return NextResponse.redirect(canonical, { status: 308 })
  }

  const { pathname } = request.nextUrl;

  // API routes: security headers only, skip locale handling & CSRF cookie
  if (pathname.startsWith('/api')) {
    const response = NextResponse.next();
    return applySecurityHeaders(response);
  }

  // Admin routes: skip locale handling (admin is NOT under [locale])
  if (pathname.startsWith('/admin')) {
    const response = NextResponse.next();
    return applySecurityHeaders(response);
  }

  // All other routes: next-intl locale routing + security headers.
  // Two cookies were blocking Vercel edge caching:
  //   1. csrf_token — moved to lazy /api/csrf fetch in AuthProvider
  //   2. NEXT_LOCALE — next-intl v4 writes this via response.cookies.set()
  //      even with localeDetection: false. We delete it from response.cookies
  //      before the Edge runtime serializes it to Set-Cookie headers.
  //      Locale is communicated via URL prefix (/es/casting) and client-side
  //      localStorage ('aim_locale_chosen') instead.
  const response = intlMiddleware(request);
  // Delete the NEXT_LOCALE cookie next-intl set so it is never serialized
  // into a Set-Cookie header. Must use response.cookies.delete(), not
  // response.headers.delete('set-cookie') — the Edge runtime serializes
  // response.cookies AFTER middleware returns, bypassing header mutations.
  response.cookies.delete('NEXT_LOCALE');
  return applySecurityHeaders(response);
}

export const config = {
  // Apply middleware to all routes except Next.js internals and static files
  matcher: [
    '/((?!_next/static|_next/image|favicon|icons|images|manifest|sw\\.js|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|wasm|json|mp4|webm|pdf|html|woff2?|ttf|eot|onnx|txt)).*)',
  ],
};

