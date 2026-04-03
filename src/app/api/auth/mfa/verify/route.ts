/**
 * POST /api/auth/mfa/verify
 * ---------------------------------------------------------------------------
 * Verifies the Email OTP submitted by the user after the login challenge.
 * On success: clears the temp OTP and returns the auth tokens (same as login).
 *
 * Body: { userId: string, code: string }
 *
 * Security:
 *  - OTP is bcrypt-hashed in DB (compare, not equality check)
 *  - One-time use: cleared immediately after successful verification
 *  - 10-minute expiry enforced server-side
 *  - Rate-limited to prevent brute-force
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createToken, createRefreshToken, setUserCookie } from '@/lib/auth'
import { authLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { compare } from 'bcryptjs'

export async function POST(request: Request) {
    const blocked = authLimiter.check(request)
    if (blocked) return blocked

    try {
        const { userId, code } = await request.json() as { userId: string; code: string }

        if (!userId || !code) {
            return NextResponse.json({ error: 'userId and code are required' }, { status: 400 })
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = await (prisma as any).user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                tokenVersion: true,
                mfaTempCode: true,
                mfaExpiresAt: true,
            },
        })

        if (!user) return NextResponse.json({ error: 'Invalid request' }, { status: 401 })

        // Check expiry
        if (!user.mfaTempCode || !user.mfaExpiresAt || new Date() > user.mfaExpiresAt) {
            return NextResponse.json({
                error: 'OTP has expired. Please request a new code.',
            }, { status: 401 })
        }

        // Verify OTP
        const valid = await compare(code, user.mfaTempCode)
        if (!valid) {
            logger.warn('auth/mfa/verify', `Invalid OTP attempt for user ${userId}`)
            return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 401 })
        }

        // Clear OTP (one-time use)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).user.update({
            where: { id: userId },
            data: { mfaTempCode: null, mfaExpiresAt: null },
        })

        // Issue tokens (same as login)
        const payload = { userId: user.id, role: user.role, email: user.email, tokenVersion: user.tokenVersion }
        const token = await createToken(payload)
        const refresh = await createRefreshToken(payload)
        await setUserCookie(token, refresh)

        logger.info('auth/mfa/verify', `MFA verified for ${user.email}`)

        const redirectTo = ['admin', 'superadmin'].includes(user.role) ? '/admin' : '/dashboard'

        return NextResponse.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
            redirectTo,
        })
    } catch (error) {
        logger.error('auth/mfa/verify', 'MFA verification failed', { error })
        return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 })
    }
}
