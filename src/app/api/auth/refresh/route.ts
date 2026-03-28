import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, createToken, createRefreshToken } from '@/lib/auth'
import { prisma } from '@/lib/db'

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

        // Verify tokenVersion against DB — prevents use of revoked tokens
        const user = await prisma.user.findUnique({
            where: { id: payload.userId as string },
            select: { tokenVersion: true, role: true, email: true },
        })
        if (!user || user.tokenVersion !== (payload.tokenVersion ?? 0)) {
            return NextResponse.json({ error: 'Token revoked' }, { status: 401 })
        }

        const tokenPayload = {
            userId: payload.userId,
            role: user.role,
            email: user.email,
            tokenVersion: user.tokenVersion,  // CRITICAL: must carry tokenVersion forward
        }

        // Issue new token pair (rotation — old refresh token is effectively replaced)
        const newAccess = await createToken(tokenPayload)
        const newRefresh = await createRefreshToken(tokenPayload)

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
