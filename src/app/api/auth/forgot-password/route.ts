import { NextResponse } from 'next/server'
import { hash, compare } from 'bcryptjs'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/mailer'
import { forgotPasswordCode, passwordChangedEmail } from '@/lib/email-templates'

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
    try {
        const { email, password, action, code } = await request.json()

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 })
        }

        const normalizedEmail = email.toLowerCase().trim()

        // ─── Step 1: Verify email exists and send 6-digit code ───
        if (action === 'verify') {
            const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
            if (!user) {
                return NextResponse.json({ error: 'No account found with that email' }, { status: 404 })
            }

            // Rate limit: max 3 codes per email per 15 minutes
            const existing = resetCodes.get(normalizedEmail)
            if (existing && existing.attempts >= 3 && existing.expiresAt > Date.now()) {
                return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
            }

            const newCode = generateCode()
            resetCodes.set(normalizedEmail, {
                code: newCode,
                expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
                attempts: (existing?.attempts || 0) + 1,
            })

            // Send the code via email
            const sent = await sendEmail({
                to: normalizedEmail,
                subject: 'Password Reset Code | AIM Studio',
                html: forgotPasswordCode(user.name || 'there', newCode),
            })

            if (!sent) {
                return NextResponse.json({
                    success: true,
                    message: 'If email sending is configured, a code has been sent to your email.',
                    emailConfigured: false,
                })
            }

            return NextResponse.json({
                success: true,
                message: 'A 6-digit code has been sent to your email. It expires in 10 minutes.',
                emailConfigured: true,
            })
        }

        // ─── Step 2: Verify the code ───
        if (action === 'verify-code') {
            if (!code) {
                return NextResponse.json({ error: 'Verification code is required' }, { status: 400 })
            }

            const stored = resetCodes.get(normalizedEmail)
            if (!stored) {
                return NextResponse.json({ error: 'No reset code found. Please request a new one.' }, { status: 400 })
            }
            if (stored.expiresAt < Date.now()) {
                resetCodes.delete(normalizedEmail)
                return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 400 })
            }
            if (stored.code !== code) {
                return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 400 })
            }

            return NextResponse.json({ success: true, message: 'Code verified. You can now set a new password.' })
        }

        // ─── Step 3: Reset password (requires valid code) ───
        if (action === 'reset') {
            if (!code) {
                return NextResponse.json({ error: 'Verification code is required' }, { status: 400 })
            }

            const stored = resetCodes.get(normalizedEmail)
            if (!stored || stored.expiresAt < Date.now() || stored.code !== code) {
                return NextResponse.json({ error: 'Invalid or expired code. Please start over.' }, { status: 400 })
            }

            const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
            if (!user) {
                return NextResponse.json({ error: 'No account found with that email' }, { status: 404 })
            }
            if (!password || password.length < 6) {
                return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
            }

            // ── Password reuse check ──
            // Check against current password
            if (user.passwordHash) {
                const sameAsCurrent = await compare(password, user.passwordHash)
                if (sameAsCurrent) {
                    return NextResponse.json({
                        error: 'You cannot reuse your current password. Please choose a new one.',
                    }, { status: 400 })
                }
            }

            // Check against recent password history
            const recentPasswords = await prisma.passwordHistory.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: 'desc' },
                take: PASSWORD_HISTORY_LIMIT,
            })

            for (const entry of recentPasswords) {
                const matchesOld = await compare(password, entry.passwordHash)
                if (matchesOld) {
                    return NextResponse.json({
                        error: `This password was recently used. Please choose a password you haven't used in your last ${PASSWORD_HISTORY_LIMIT} changes.`,
                    }, { status: 400 })
                }
            }

            // ── Save current password to history before changing ──
            if (user.passwordHash) {
                await prisma.passwordHistory.create({
                    data: { userId: user.id, passwordHash: user.passwordHash },
                })

                // Clean up old entries — keep only the last N
                const allHistory = await prisma.passwordHistory.findMany({
                    where: { userId: user.id },
                    orderBy: { createdAt: 'desc' },
                })
                if (allHistory.length > PASSWORD_HISTORY_LIMIT) {
                    const toDelete = allHistory.slice(PASSWORD_HISTORY_LIMIT).map((h: { id: string }) => h.id)
                    await prisma.passwordHistory.deleteMany({
                        where: { id: { in: toDelete } },
                    })
                }
            }

            // ── Set the new password ──
            // Also mark emailVerified = true: the reset flow already proved the
            // user owns this inbox (they received and entered the 6-digit code),
            // so blocking login afterward with an email-verification error is wrong.
            const passwordHash = await hash(password, 12)
            await prisma.user.update({
                where: { email: normalizedEmail },
                data: { passwordHash, tokenVersion: { increment: 1 }, emailVerified: true },
            })

            // Clean up used code
            resetCodes.delete(normalizedEmail)

            // Send password change notification email (fire-and-forget)
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || ''
            sendEmail({
                to: normalizedEmail,
                subject: 'Your AIM Studio Password Was Changed',
                html: passwordChangedEmail(user.name || 'there', siteUrl),
            }).catch(() => { /* silent — never block the response */ })

            return NextResponse.json({ success: true, message: 'Password reset successfully' })
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    } catch {
        return NextResponse.json({ error: 'Password reset failed' }, { status: 500 })
    }
}

