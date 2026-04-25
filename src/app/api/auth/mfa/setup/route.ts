/**
 * POST /api/auth/mfa/setup
 * ---------------------------------------------------------------------------
 * Generates a 6-digit Email OTP for admin/superadmin users who have MFA enabled
 * (or are in the process of enabling it). Sends the code via the existing mailer.
 *
 * Rate-limited to prevent OTP spam (reuses authLimiter: 10 req/min).
 *
 * Body: { userId: string }  — only trusts the session, not the body userId
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendTransactionalEmail } from '@/lib/email-router'
import { mfaOtpEmail, mfaOtpEmailLocalized } from '@/lib/email-templates'
import { authLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { getSessionAndRefresh } from '@/lib/auth'
import { hash } from 'bcryptjs'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
const OTP_TTL_MS = 10 * 60 * 1000 // 10 minutes

export async function POST(request: Request) {
    const blocked = authLimiter.check(request)
    if (blocked) return blocked

    try {
        const session = await getSessionAndRefresh()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userId = (session as any)?.userId || (session as any)?.id
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Only admin / superadmin accounts can use MFA
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = await (prisma as any).user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, role: true, preferredLanguage: true },
        })

        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
        if (!['admin', 'superadmin'].includes(user.role)) {
            return NextResponse.json({ error: 'MFA is only available for admin accounts' }, { status: 403 })
        }

        // Generate 6-digit OTP
        const code = String(Math.floor(100000 + Math.random() * 900000))
        const hashedCode = await hash(code, 8) // lightweight hash for storage
        const expiresAt = new Date(Date.now() + OTP_TTL_MS)

        // Persist temp OTP (overwrite any previous)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).user.update({
            where: { id: userId },
            data: {
                mfaTempCode: hashedCode,
                mfaExpiresAt: expiresAt,
            },
        })

        // Send OTP email in user's preferred language
        const mfaLocale: string = (user as any).preferredLanguage || 'en'
        const html = await mfaOtpEmailLocalized(user.name, code, SITE_URL, mfaLocale).catch(() => mfaOtpEmail(user.name, code, SITE_URL))
        const { t: emailT } = await import('@/lib/email-i18n')
        const mfaSubject = emailT('securityVerification', mfaLocale, 'subject')
            || `🔐 Your AIM Studio sign-in code: ${code}`
        await sendTransactionalEmail({
            to: user.email,
            subject: mfaSubject,
            html,
        })

        logger.info('auth/mfa/setup', `OTP sent to ${user.email}`)

        return NextResponse.json({
            success: true,
            message: `A verification code has been sent to ${user.email}. It expires in 10 minutes.`,
        })
    } catch (error) {
        logger.error('auth/mfa/setup', 'Failed to send MFA OTP', { error })
        return NextResponse.json({ error: 'Failed to send OTP. Please try again.' }, { status: 500 })
    }
}
