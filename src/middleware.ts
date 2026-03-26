import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { NextResponse, NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const intlMiddleware = createMiddleware(routing)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Admin API guard — runs before i18n routing
  if (pathname.startsWith('/api/admin')) {
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
    // Admin token valid — pass through without i18n processing
    return NextResponse.next()
  }

  // Admin panel routes — skip next-intl entirely so it cannot
  // rewrite or redirect /admin/* paths
  if (pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  // All other routes — apply i18n middleware
  return intlMiddleware(request)
}

export const config = {
  // Match all routes EXCEPT api, static files, and _next internals
  matcher: [
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
}
