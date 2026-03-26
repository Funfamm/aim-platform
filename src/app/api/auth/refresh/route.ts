import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, createToken, createRefreshToken } from '@/lib/auth'

// POST /api/auth/refresh — exchange valid refresh token for new access + refresh tokens
export async function POST() {
    try {
        const cookieStore = await cookies()
        const refreshToken = cookieStore.get('refresh_token')?.value

        if (!refreshToken) {
            return NextResponse.json({ error: 'No refresh token' }, { status: 401 })
        }

        const payload = await verifyToken(refreshToken)
        if (!payload) {
            return NextResponse.json({ error: 'Refresh token expired or invalid' }, { status: 401 })
        }

        // Issue new token pair (rotation — old refresh token is effectively replaced)
        const newAccess = await createToken({
            userId: payload.userId,
            role: payload.role,
            email: payload.email,
        })
        const newRefresh = await createRefreshToken({
            userId: payload.userId,
            role: payload.role,
            email: payload.email,
        })

        // Set new cookies
        cookieStore.set('user_token', newAccess, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60, // 15 minutes
            path: '/',
        })
        cookieStore.set('refresh_token', newRefresh, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60, // 7 days
            path: '/',
        })

        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ error: 'Token refresh failed' }, { status: 500 })
    }
}
