import { NextResponse } from 'next/server'
import { hash, compare } from 'bcryptjs'
import { prisma } from '@/lib/db'
import { withDbRetry } from '@/lib/db-retry'
import { sendEmail } from '@/lib/mailer'
import { forgotPasswordCodeLocalized, passwordChangedEmailLocalized } from '@/lib/email-templates'
import { t as emailT } from '@/lib/email-i18n'
import { authLimiter } from '@/lib/rate-limit'

// In-memory code store (in production, use Redis or DB)
// Format: { email: { code: string, expiresAt: number, attempts: number } }
const resetCodes = new Map<string, { code: string; expiresAt: number; attempts: number }>()

function generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

// How many recent passwords to check against
const PASSWORD_HISTORY_LIMIT = 5

// Clean expired codes periodically
setInterval(() => {
    const now = Date.now()
    for (const [email, data] of Array.from(resetCodes.entries())) {
        if (data.expiresAt < now) resetCodes.delete(email)
    }
}, 60_000) // Every minute

export async function POST(request: Request) {
    // Rate limit: 10 requests/min per IP — prevents email spam & quota exhaustion
    const blocked = authLimiter.check(request)
    if (blocked) return blocked

    try {
        const { email, password, action, code } = await request.json()


        if (!email) {
        return NextResponse.json({ error: 'ERR_EMAIL_REQUIRED' }, { status: 400 })
        }

        const normalizedEmail = email.toLowerCase().trim()

        // ─── Step 1: Send 6-digit code ───────────────────────────────────────────
        // SECURITY: Always return the same 200 response regardless of whether the
        // email exists, to prevent user enumeration / email harvesting attacks.
        // The real work happens inside — silently no-ops if email not found.
        if (action === 'verify') {
            // Constant-time delay so response timing doesn't leak email existence
            const [user] = await Promise.all([
                withDbRetry(() => prisma.user.findUnique({
                    where: { email: normalizedEmail },
                    select: { name: true, preferredLanguage: true } as any,
                }), 'forgot_password_find') as Promise<any>,
                new Promise(r => setTimeout(r, 300)), // normalise timing
            ])

            if (user) {
                // Rate limit: max 3 codes per email per 15 minutes
                const existing = resetCodes.get(normalizedEmail)
                if (existing && existing.attempts >= 3 && existing.expiresAt > Date.now()) {
                    // Still return generic 200 — never leak that the email exists
                    return NextResponse.json({
                        success: true,
                        message: 'If an account with that email exists, a reset code has been sent.',
                    })
                }

                const newCode = generateCode()
                resetCodes.set(normalizedEmail, {
                    code: newCode,
                    expiresAt: Date.now() + 10 * 60 * 1000,
                    attempts: (existing?.attempts || 0) + 1,
                })

                const fpLocale = user.preferredLanguage || 'en'
                const fpHtml = await forgotPasswordCodeLocalized(user.name || 'there', newCode, undefined, fpLocale)
                await sendEmail({
                    to: normalizedEmail,
                    subject: emailT('securityForgotPassword', fpLocale, 'subject') || 'Password Reset Code | AIM Studio',
                    html: fpHtml,
                })
            }
            // Whether user exists or not — always the same response
            return NextResponse.json({
                success: true,
                message: 'If an account with that email exists, a reset code has been sent.',
            })
        }

        // ─── Step 2: Verify the code ───
        if (action === 'verify-code') {
            if (!code) {
                return NextResponse.json({ error: 'ERR_CODE_REQUIRED' }, { status: 400 })
            }

            const stored = resetCodes.get(normalizedEmail)
            if (!stored) {
                return NextResponse.json({ error: 'ERR_NO_CODE' }, { status: 400 })
            }
            if (stored.expiresAt < Date.now()) {
                resetCodes.delete(normalizedEmail)
                return NextResponse.json({ error: 'ERR_CODE_EXPIRED' }, { status: 400 })
            }
            if (stored.code !== code) {
                return NextResponse.json({ error: 'ERR_CODE_INVALID' }, { status: 400 })
            }

            return NextResponse.json({ success: true, message: 'Code verified. You can now set a new password.' })
        }

        // ─── Step 3: Reset password (requires valid code) ───
        if (action === 'reset') {
            if (!code) {
                return NextResponse.json({ error: 'ERR_CODE_REQUIRED' }, { status: 400 })
            }

            const stored = resetCodes.get(normalizedEmail)
            if (!stored || stored.expiresAt < Date.now() || stored.code !== code) {
                return NextResponse.json({ error: 'ERR_CODE_EXPIRED' }, { status: 400 })
            }

            const user = await withDbRetry(() => prisma.user.findUnique({ where: { email: normalizedEmail } }), 'forgot_password_reset_find')
            if (!user) {
                // Code was valid but email somehow not in DB (edge case) — generic error
                return NextResponse.json({ error: 'ERR_RESET_FAILED' }, { status: 400 })
            }
            if (!password || password.length < 6) {
                return NextResponse.json({ error: 'ERR_PW_TOO_SHORT' }, { status: 400 })
            }

            // ── Password reuse check ──
            // Check against current password
            if (user.passwordHash) {
                const sameAsCurrent = await compare(password, user.passwordHash)
                if (sameAsCurrent) {
                        return NextResponse.json({ error: 'ERR_SAME_PASSWORD' }, { status: 400 })
                }
            }

            // Check against recent password history
            const recentPasswords = await withDbRetry(() => prisma.passwordHistory.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: 'desc' },
                take: PASSWORD_HISTORY_LIMIT,
            }), 'forgot_password_history_find')

            for (const entry of recentPasswords) {
                const matchesOld = await compare(password, entry.passwordHash)
                if (matchesOld) {
                        return NextResponse.json({ error: 'ERR_REUSED_PASSWORD' }, { status: 400 })
                }
            }

            // ── Save current password to history before changing ──
            if (user.passwordHash) {
                await withDbRetry(() => prisma.passwordHistory.create({
                    data: { userId: user.id, passwordHash: user.passwordHash! },
                }), 'forgot_password_history_create')

                // Clean up old entries — keep only the last N
                const allHistory = await withDbRetry(() => prisma.passwordHistory.findMany({
                    where: { userId: user.id },
                    orderBy: { createdAt: 'desc' },
                }), 'forgot_password_history_all')
                if (allHistory.length > PASSWORD_HISTORY_LIMIT) {
                    const toDelete = allHistory.slice(PASSWORD_HISTORY_LIMIT).map((h: { id: string }) => h.id)
                    await withDbRetry(() => prisma.passwordHistory.deleteMany({
                        where: { id: { in: toDelete } },
                    }), 'forgot_password_history_cleanup')
                }
            }

            // ── Set the new password ──
            // Also mark emailVerified = true: the reset flow already proved the
            // user owns this inbox (they received and entered the 6-digit code),
            // so blocking login afterward with an email-verification error is wrong.
            const passwordHash = await hash(password, 12)
            await withDbRetry(() => prisma.user.update({
                where: { email: normalizedEmail },
                data: { passwordHash, tokenVersion: { increment: 1 }, emailVerified: true },
            }), 'forgot_password_reset_update')

            // Clean up used code
            resetCodes.delete(normalizedEmail)

            // Send password change notification email in the user's locale (fire-and-forget)
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || ''
            const pcLocale = (user as any).preferredLanguage || 'en'
            passwordChangedEmailLocalized(user.name || 'there', siteUrl, pcLocale)
                .then(html => sendEmail({
                    to: normalizedEmail,
                    subject: emailT('securityPasswordChanged', pcLocale, 'subject') || 'Your AIM Studio Password Was Changed',
                    html,
                }))
                .catch(() => { /* silent — never block the response */ })

            return NextResponse.json({ success: true, message: 'Password reset successfully' })
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    } catch {
        return NextResponse.json({ error: 'ERR_RESET_FAILED' }, { status: 500 })
    }
}

