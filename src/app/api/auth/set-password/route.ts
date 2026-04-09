import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/db'
import { getUserSession, createToken, createRefreshToken, setUserCookie } from '@/lib/auth'
import { sendEmail } from '@/lib/mailer'
import { t as emailT } from '@/lib/email-i18n'

/**
 * POST /api/auth/set-password
 *
 * Two-step flow for OAuth users who have NO password yet:
 *
 * Step 1 — { action: 'send-code' }
 *   Sends a 6-digit verification code to the user's email.
 *
 * Step 2 — { action: 'set', code, newPassword }
 *   Validates the code, hashes and saves the password, marks emailVerified.
 */

// In-memory store — same pattern as forgot-password
const pendingCodes = new Map<string, { code: string; expiresAt: number; attempts: number }>()

setInterval(() => {
    const now = Date.now()
    for (const [k, v] of Array.from(pendingCodes.entries())) {
        if (v.expiresAt < now) pendingCodes.delete(k)
    }
}, 60_000)

function genCode() {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(request: Request) {
    try {
        const session = await getUserSession()
        if (!session?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { id: session.userId as string },
            select: {
                id: true,
                email: true,
                name: true,
                passwordHash: true,
                role: true,
                preferredLanguage: true,
            } as Record<string, boolean>,
        }) as { id: string; email: string; name: string; passwordHash: string | null; role: string; preferredLanguage?: string } | null

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        if (user.passwordHash) {
            return NextResponse.json(
                { error: 'You already have a password. Use "Change Password" instead.' },
                { status: 400 },
            )
        }

        const body = await request.json()
        const { action, code, newPassword } = body

        const locale = (user.preferredLanguage || 'en') as string

        // ── Step 1: Send verification code ─────────────────────────────────
        if (action === 'send-code') {
            const existing = pendingCodes.get(user.email)
            if (existing && existing.attempts >= 3 && existing.expiresAt > Date.now()) {
                return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
            }

            const newCode = genCode()
            pendingCodes.set(user.email, {
                code: newCode,
                expiresAt: Date.now() + 10 * 60_000, // 10 min
                attempts: (existing?.attempts || 0) + 1,
            })

            const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0a0a12;font-family:'Segoe UI',system-ui,sans-serif">
<div style="max-width:520px;margin:40px auto;background:linear-gradient(145deg,#12121f 0%,#1a1a2e 100%);border:1px solid rgba(212,168,83,0.15);border-radius:16px;padding:40px">
<div style="text-align:center;margin-bottom:24px">
  <span style="font-size:32px">🔐</span>
</div>
<h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#e8e8f0;text-align:center">
  ${locale === 'en' ? 'Set Your Password' : 'Verify Your Identity'}
</h1>
<p style="margin:0 0 24px;font-size:14px;color:#8888a0;text-align:center;line-height:1.5">
  ${locale === 'en' ? 'Use this code to create a password for your account.' : 'Enter this code to set up your password.'}
</p>
<div style="text-align:center;margin:24px 0">
  <div style="display:inline-block;padding:16px 32px;background:rgba(212,168,83,0.08);border:2px solid rgba(212,168,83,0.25);border-radius:12px;letter-spacing:8px;font-size:28px;font-weight:800;color:#e4b95a;font-family:monospace">
    ${newCode}
  </div>
</div>
<p style="margin:16px 0 0;font-size:12px;color:#666;text-align:center">
  This code expires in 10 minutes.
</p>
<hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:24px 0"/>
<p style="margin:0;font-size:11px;color:#555;text-align:center">
  AI Impact Media Studio
</p>
</div>
</body></html>`

            const subject = emailT('securityVerifyEmail', locale, 'subject') || 'Verify Your Identity - AIM Studio'

            await sendEmail({ to: user.email, subject, html })

            return NextResponse.json({ success: true, message: 'Verification code sent to your email.' })
        }

        // ── Step 2: Set password ────────────────────────────────────────────
        if (action === 'set') {
            if (!code || !newPassword) {
                return NextResponse.json({ error: 'Code and new password are required.' }, { status: 400 })
            }
            if (newPassword.length < 6) {
                return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
            }

            const stored = pendingCodes.get(user.email)
            if (!stored) {
                return NextResponse.json({ error: 'No verification code found. Please request a new one.' }, { status: 400 })
            }
            if (stored.expiresAt < Date.now()) {
                pendingCodes.delete(user.email)
                return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 400 })
            }
            if (stored.code !== code) {
                return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 400 })
            }

            // Set password + mark verified
            const passwordHash = await hash(newPassword, 12)
            await prisma.user.update({
                where: { id: user.id },
                data: { passwordHash, emailVerified: true, tokenVersion: { increment: 1 } },
            })

            pendingCodes.delete(user.email)

            // Refresh session tokens
            const tvRows = await prisma.$queryRaw<{ tokenVersion: number }[]>`SELECT "tokenVersion" FROM "User" WHERE "id" = ${user.id}`
            const tokenVersion = tvRows[0]?.tokenVersion ?? 0
            const payload = { userId: user.id, role: user.role, email: user.email, tokenVersion }
            const token = await createToken(payload)
            const refresh = await createRefreshToken(payload)
            await setUserCookie(token, refresh)

            return NextResponse.json({ success: true, message: 'Password created successfully. You can now log in with email and password.' })
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    } catch (err) {
        console.error('[set-password]', err)
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }
}
