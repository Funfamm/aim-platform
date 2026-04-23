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
import { readInviteCookie } from '@/lib/invite-cookie'

export async function POST(request: Request) {
    const blocked = authLimiter.check(request)
    if (blocked) return blocked

    try {
        const { email, password, locale } = await request.json()

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
        }

        const normalizedEmail = email.toLowerCase().trim()

        // Single query — include all fields we need so there's no second as-any query
        const user = await withDbRetry(() => (prisma as any).user.findUnique({
            where: { email: normalizedEmail },
            select: {
                id: true, name: true, email: true, role: true,
                passwordHash: true, avatar: true, bannerUrl: true,
                emailVerified: true, tokenVersion: true, mfaEnabled: true,
                preferredLanguage: true, accentColor: true, themeMode: true,
                failedLoginAttempts: true, lockedUntil: true, suspended: true,
            },
        }), 'login_find_user') as {
            id: string; name: string; email: string; role: string;
            passwordHash: string | null; avatar: string | null; bannerUrl: string | null;
            emailVerified: boolean; tokenVersion: number; mfaEnabled: boolean;
            preferredLanguage: string | null; accentColor: string | null; themeMode: string | null;
            failedLoginAttempts: number; lockedUntil: Date | null; suspended: boolean;
        } | null

        if (!user || !user.passwordHash) {
            recordAuthFailure('invalid_credentials')
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
        }

        // ── Account suspension (manual admin ban) ──────────────────────────────
        if (user.suspended) {
            recordAuthFailure('suspended')
            logger.warn('auth/login', `Login blocked — account suspended: ${normalizedEmail}`)
            return NextResponse.json({
                error: 'Your account has been suspended. Please contact support.',
                suspended: true,
            }, { status: 403 })
        }

        // ── Automatic lockout (too many failed attempts) ───────────────────────
        const now = new Date()
        if (user.lockedUntil && user.lockedUntil > now) {
            const minutesLeft = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60_000)
            recordAuthFailure('locked')
            logger.warn('auth/login', `Login blocked — account locked: ${normalizedEmail} (${minutesLeft}m remaining)`)
            return NextResponse.json({
                error: `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
                locked: true,
                minutesLeft,
            }, { status: 423 })
        }

        const valid = await compare(password, user.passwordHash)
        if (!valid) {
            recordAuthFailure('invalid_credentials')
            const MAX_ATTEMPTS = 5
            const LOCKOUT_MINUTES = 60
            const newAttempts = (user.failedLoginAttempts ?? 0) + 1
            const shouldLock = newAttempts >= MAX_ATTEMPTS
            await (prisma as any).user.update({
                where: { id: user.id },
                data: {
                    failedLoginAttempts: newAttempts,
                    lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : undefined,
                },
            })
            const remaining = MAX_ATTEMPTS - newAttempts
            if (shouldLock) {
                logger.warn('auth/login', `Account locked after ${MAX_ATTEMPTS} failed attempts: ${normalizedEmail}`)
                return NextResponse.json({
                    error: `Too many failed attempts. Your account is locked for ${LOCKOUT_MINUTES} minutes.`,
                    locked: true,
                    minutesLeft: LOCKOUT_MINUTES,
                }, { status: 423 })
            }
            return NextResponse.json({
                error: `Invalid email or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.`,
                attemptsRemaining: remaining,
            }, { status: 401 })
        }

        // ── Successful login — reset failed attempts ───────────────────────────
        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
            void (prisma as any).user.update({
                where: { id: user.id },
                data: { failedLoginAttempts: 0, lockedUntil: null },
            }).catch(() => {})
        }

        // All fields already included in the initial query — no second round-trip needed
        const isVerified = user.emailVerified === true
        const tokenVersion = user.tokenVersion ?? 0
        const mfaEnabled = user.mfaEnabled === true

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

        // If the user logged in from a non-English locale page and their
        // stored preferredLanguage differs, update it automatically.
        // This keeps email/notification language in sync with browsing preference.
        const validLocales = ['en', 'es', 'fr', 'ar', 'zh', 'hi', 'pt', 'ru', 'ja', 'de', 'ko']
        const browsingLocale = (locale && validLocales.includes(locale)) ? locale : null
        const storedLocale = user.preferredLanguage ?? 'en'

        if (browsingLocale && browsingLocale !== storedLocale) {
            // Fire-and-forget — don't block the login response
            void (prisma as any).user.update({
                where: { id: user.id },
                data: { preferredLanguage: browsingLocale },
            }).catch(() => {})
        }

        // Return the active locale: browsing locale takes priority (user actively chose it)
        const activeLocale = browsingLocale || storedLocale

        // ── Invite context redirect ────────────────────────────────────────────
        // If the user arrived via an invite link and was sent to /login to
        // authenticate, read the invite_ctx cookie and redirect them to the
        // event path instead of the default dashboard.
        const inviteCtx = await readInviteCookie().catch(() => null)
        const inviteRedirectTo = inviteCtx?.eventPath ?? null

        return NextResponse.json({
            user: {
                id: user.id, name: user.name, email: user.email,
                avatar: user.avatar, bannerUrl: user.bannerUrl, role: user.role,
                accentColor: user.accentColor, themeMode: user.themeMode,
            },
            redirectTo: inviteRedirectTo ?? redirectTo,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            preferredLanguage: activeLocale,
        })
    } catch (error) {
        logger.error('auth/login', 'Login failed', { error })
        return NextResponse.json({ error: 'Login failed' }, { status: 500 })
    }
}
