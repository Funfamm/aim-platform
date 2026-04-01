import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Apply security headers to all API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    const response = NextResponse.next();
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    // Additional headers can be added here (CSP, Referrer-Policy, etc.)
    return response;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
