import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const JWT_SECRET_RAW = process.env.JWT_SECRET
if (!JWT_SECRET_RAW && process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production. Set it to a cryptographically random string (min 32 chars).')
}
const JWT_SECRET = new TextEncoder().encode(
    JWT_SECRET_RAW || '__dev-only-secret-do-not-use-in-production__'
)

export type UserRole = 'member' | 'admin' | 'superadmin'

export interface TokenPayload {
    userId: string
    role: UserRole
    email?: string
    tokenVersion?: number
    [key: string]: unknown
}

export async function createToken(payload: Record<string, unknown>) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .sign(JWT_SECRET)
}

export async function createRefreshToken(payload: Record<string, unknown>) {
    // Embed minimal claim set plus tokenVersion for revocation
    const slim = { userId: payload.userId, role: payload.role, email: payload.email, tokenVersion: payload.tokenVersion }
    return await new SignJWT(slim)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET)
        return payload as unknown as TokenPayload
    } catch {
        return null
    }
}

// Unified session — READ-ONLY version safe for Server Components (RSC)
// Does NOT attempt to write cookies (Next.js 15 prohibits cookie writes in RSC render)
// Returns the session payload from whichever valid token is present
export async function getSession(): Promise<TokenPayload | null> {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('user_token')?.value

    // 1. Try the short-lived access token first
    if (accessToken) {
        const payload = await verifyToken(accessToken)
        if (payload) return payload
    }

    // 2. Access token missing or expired — check the refresh token (read-only)
    const refreshToken = cookieStore.get('refresh_token')?.value
    if (!refreshToken) return null

    const refreshPayload = await verifyToken(refreshToken)
    if (!refreshPayload) return null // refresh also expired → force re-login

    // Verify tokenVersion against DB — prevents use of revoked refresh tokens
    const user = await prisma.user.findUnique({
        where: { id: refreshPayload.userId as string },
        select: { tokenVersion: true },
    })
    if (!user || user.tokenVersion !== (refreshPayload.tokenVersion ?? 0)) {
        return null // revoked — force re-login
    }

    // Return the refresh payload — the new access token will be issued by API route or /api/auth/me
    return refreshPayload
}

// API-route-safe version: attempts to silently renew the access token
// Only call this from within API route handlers (not RSC/layout)
export async function getSessionAndRefresh(): Promise<TokenPayload | null> {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('user_token')?.value

    if (accessToken) {
        const payload = await verifyToken(accessToken)
        if (payload) return payload
    }

    const refreshToken = cookieStore.get('refresh_token')?.value
    if (!refreshToken) return null

    const refreshPayload = await verifyToken(refreshToken)
    if (!refreshPayload) return null

    const user = await prisma.user.findUnique({
        where: { id: refreshPayload.userId as string },
        select: { tokenVersion: true },
    })
    if (!user || user.tokenVersion !== (refreshPayload.tokenVersion ?? 0)) {
        return null
    }

    // Issue a new access token and write it — safe here because we're in an API route
    try {
        const newAccess = await createToken({
            userId: refreshPayload.userId,
            role: refreshPayload.role,
            email: refreshPayload.email,
            tokenVersion: refreshPayload.tokenVersion,
        })
        cookieStore.set('user_token', newAccess, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60,
            path: '/',
        })
        return refreshPayload
    } catch {
        return null
    }
}

// Alias for backward compatibility — same as getSession (read-only)
export async function getUserSession(): Promise<TokenPayload | null> {
    return getSession()
}


// Require authenticated admin (admin or superadmin)
// Returns the session or sends 401
// Uses getSessionAndRefresh so the access token is silently renewed in API routes
// (getSession is read-only and cannot write cookies, so it fails after 15min expiry)
export async function requireAdmin(): Promise<TokenPayload> {
    const session = await getSessionAndRefresh()
    if (!session) {
        throw new Error('Unauthorized')
    }
    if (session.role !== 'admin' && session.role !== 'superadmin') {
        throw new Error('Forbidden: admin access required')
    }
    return session
}

// Require superadmin specifically
export async function requireSuperAdmin(): Promise<TokenPayload> {
    const session = await getSessionAndRefresh()
    if (!session) {
        throw new Error('Unauthorized')
    }
    if (session.role !== 'superadmin') {
        throw new Error('Forbidden: superadmin access required')
    }
    return session
}

// Safe version of requireAdmin that returns a NextResponse on failure
// Use this in API routes for cleaner error handling
export async function requireAdminResponse(): Promise<TokenPayload | NextResponse> {
    const session = await getSession()
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.role !== 'admin' && session.role !== 'superadmin') {
        return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
    }
    return session
}

// Helper to check if session is an error response
export function isAuthError(result: TokenPayload | NextResponse): result is NextResponse {
    return result instanceof NextResponse
}

export async function setUserCookie(accessToken: string, refreshToken?: string) {
    const cookieStore = await cookies()
    cookieStore.set('user_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60, // 15 minutes
        path: '/',
    })
    if (refreshToken) {
        cookieStore.set('refresh_token', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60, // 7 days
            path: '/',
        })
    }
}

export async function clearUserCookie() {
    const cookieStore = await cookies()
    cookieStore.delete('user_token')
    // Must specify path to match how the cookie was set, otherwise browsers ignore the deletion
    cookieStore.set('refresh_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0,
        path: '/',
    })
    // Also clear legacy admin_token if it exists
    cookieStore.delete('admin_token')
}
