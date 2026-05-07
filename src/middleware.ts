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
  //      even with localeDetection: false.
  //
  // Both response.headers.delete('set-cookie') and response.cookies.delete()
  // fail — the Edge runtime serializes response.cookies AFTER middleware returns,
  // re-adding the Set-Cookie header. The only reliable fix is to reconstruct the
  // response from scratch, copying all headers except set-cookie, so the Edge
  // runtime has no cookie store entry to serialize.
  const intlResponse = intlMiddleware(request);

  // Build a clean response — same status + body intent, but no Set-Cookie.
  const cleanResponse = new NextResponse(null, {
    status: intlResponse.status,
    statusText: intlResponse.statusText,
  });

  // Copy every header except set-cookie from the intlMiddleware response.
  intlResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'set-cookie') {
      cleanResponse.headers.set(key, value);
    }
  });

  return applySecurityHeaders(cleanResponse);
}

export const config = {
  // Apply middleware to all routes except Next.js internals and static files
  matcher: [
    '/((?!_next/static|_next/image|favicon|icons|images|manifest|sw\\.js|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|wasm|json|mp4|webm|pdf|html|woff2?|ttf|eot|onnx|txt)).*)',
  ],
};

