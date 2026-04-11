import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/db'
import { withDbRetry } from '@/lib/db-retry'
import { authLimiter } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/mailer'
import { verificationEmailLocalized, welcomeEmailWithOverrides } from '@/lib/email-templates'
import { validatePassword } from '@/lib/validation'

export async function POST(request: Request) {
    const blocked = authLimiter.check(request)
    if (blocked) return blocked

    try {
        const { name, email, password, locale } = await request.json()

        if (!name || !email || !password) {
            return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 })
        }

        const pwCheck = validatePassword(password)
        if (!pwCheck.valid) {
            return NextResponse.json({ error: pwCheck.message }, { status: 400 })
        }

        // Check if user exists
        const existing = await withDbRetry(() => prisma.user.findUnique({ where: { email } }), 'register_check_existing')
        if (existing) {
            // If they exist but never verified, resend a new code
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (!(existing as any).emailVerified) {
                const code = Math.floor(100000 + Math.random() * 900000).toString()
                const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString()
                const passwordHash = await hash(password, 12)
                await withDbRetry(() => prisma.user.update({
                    where: { email },
                    data: {
                        name,                              // ← use the NEW submitted name
                        passwordHash,                      // ← update to the new password
                        verificationCode: code,
                        verificationExpiry: new Date(expiry),
                    } as any,
                }), 'register_update_existing')
                void verificationEmailLocalized(name, code, undefined, locale || 'en').then(html => sendEmail({ to: email, subject: emailT('securityVerification', locale || 'en', 'subject') || 'Verify your AIM Studio account', html })).catch(() => {})
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`[DEV] Re-sent verification code for ${email}: ${code}`)
                }
                return NextResponse.json({ requiresVerification: true, email }, { status: 200 })
            }
            return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
        }

        // Generate 6-digit OTP
        const code = Math.floor(100000 + Math.random() * 900000).toString()
        const expiry = new Date(Date.now() + 15 * 60 * 1000)

        // Single atomic create — all fields in one query so a stale Prisma client
        // can never leave a half-created user or fail on a second as-any update.
        const passwordHash = await hash(password, 12)
        await withDbRetry(() => (prisma as any).user.create({
            data: {
                name,
                email,
                passwordHash,
                role: 'member',
                emailVerified: false,
                verificationCode: code,
                verificationExpiry: expiry,
                ...(locale && locale !== 'en' ? { preferredLanguage: locale } : {}),
            },
        }), 'register_create_user')

        // Send verification email in the user's locale (fire-and-forget)
        void verificationEmailLocalized(name, code, undefined, locale || 'en').then(html =>
            sendEmail({ to: email, subject: emailT('securityVerification', locale || 'en', 'subject') || 'Verify your AIM Studio account', html })
        ).catch(() => {})

        // Log verification code in development so it works without SMTP
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[DEV] Email verification code for ${email}: ${code}`)
        }

        return NextResponse.json({ requiresVerification: true, email })
    } catch (error) {
        console.error('Registration error:', error)
        return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
    }
}
