import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';

// next-intl locale routing middleware
const intlMiddleware = createMiddleware(routing);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes: apply security headers only, skip locale handling
  if (pathname.startsWith('/api')) {
    const response = NextResponse.next();
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    return response;
  }

  // Admin routes: skip locale handling (admin is NOT under [locale])
  if (pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // All other routes: let next-intl handle locale detection & rewriting
  return intlMiddleware(request);
}

export const config = {
  // Apply middleware to all routes except Next.js internals and static files
  matcher: [
    '/((?!_next/static|_next/image|favicon|icons|images|manifest|sw\\.js|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff2?|ttf|eot)).*)',
  ],
};
