import { NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import { prisma } from '@/lib/db'
import { withDbRetry } from '@/lib/db-retry'
import { createToken, createRefreshToken, setUserCookie } from '@/lib/auth'
import { authLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { handleDeviceFingerprint } from '@/lib/device-fingerprint'
import { generateCsrfToken } from '@/lib/csrf'
import { recordAuthSuccess, recordAuthFailure } from '@/lib/metrics'

export async function POST(request: Request) {
    const blocked = authLimiter.check(request)
    if (blocked) return blocked

    try {
        const { email, password } = await request.json()

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
        }

        const normalizedEmail = email.toLowerCase().trim()

        const user = await withDbRetry(() => prisma.user.findUnique({
            where: { email: normalizedEmail },
        }), 'login_find_user')
        if (!user || !user.passwordHash) {
            recordAuthFailure('invalid_credentials')
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
        }

        const valid = await compare(password, user.passwordHash)
        if (!valid) {
            recordAuthFailure('invalid_credentials')
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
        }

        // Block login if email not yet verified
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userDetail = await withDbRetry(() => (prisma as any).user.findUnique({
            where: { id: user.id },
            select: { emailVerified: true, tokenVersion: true, mfaEnabled: true },
        }), 'login_get_user_detail') as { emailVerified: boolean; tokenVersion: number; mfaEnabled: boolean } | null
        const isVerified = userDetail?.emailVerified === true
        const tokenVersion = userDetail?.tokenVersion ?? 0
        const mfaEnabled = userDetail?.mfaEnabled === true

        if (!isVerified) {
            recordAuthFailure('unverified')
            return NextResponse.json({
                error: 'Please verify your email before logging in.',
                requiresVerification: true,
                email: user.email,
            }, { status: 403 })
        }

        // ── MFA gate ────────────────────────────────────────────────────────────
        // Admin/superadmin users with MFA enabled must complete the OTP flow.
        // We do NOT issue tokens here — the client POSTs to /api/auth/mfa/setup
        // to receive the OTP email, then to /api/auth/mfa/verify to get tokens.
        if (mfaEnabled && ['admin', 'superadmin'].includes(user.role)) {
            logger.info('auth/login', `MFA required for ${user.email}`)
            return NextResponse.json({
                mfaRequired: true,
                userId: user.id,   // passed back to the client for the verify step
                message: 'A verification code has been sent to your email.',
            }, { status: 202 })
        }
        // ────────────────────────────────────────────────────────────────────────

        const tokenPayload = { userId: user.id, role: user.role, email: user.email, tokenVersion }
        const token = await createToken(tokenPayload)
        const refresh = await createRefreshToken(tokenPayload)
        await setUserCookie(token, refresh)

        // Refresh CSRF cookie on login
        const { cookies } = await import('next/headers')
        const cookieStore = await cookies()
        cookieStore.set('csrf_token', generateCsrfToken(), {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60 * 24,
        })

        // New device detection + email alert (fire-and-forget)
        void handleDeviceFingerprint(request, user.id, user.name, user.email, tokenVersion).catch(() => {})

        recordAuthSuccess(user.role)

        const redirectTo = (['admin', 'superadmin'].includes(user.role)) ? '/admin' : '/dashboard'

        return NextResponse.json({
            user: {
                id: user.id, name: user.name, email: user.email,
                avatar: user.avatar, bannerUrl: user.bannerUrl, role: user.role,
            },
            redirectTo,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            preferredLanguage: (user as any).preferredLanguage ?? 'en',
        })
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        logger.error('auth/login', 'Login failed', { error })
        return NextResponse.json({
            error: 'Login failed',
            _debug: process.env.NODE_ENV !== 'production' ? msg : msg, // temp: expose in prod for diagnosis
        }, { status: 500 })
    }
}
