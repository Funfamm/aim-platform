import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createToken, createRefreshToken, setUserCookie } from '@/lib/auth'
import { sendEmail } from '@/lib/mailer'
import { verificationEmailLocalized, welcomeEmailWithOverrides } from '@/lib/email-templates'
import { t as emailT } from '@/lib/email-i18n'
import { notifyUser } from '@/lib/notifications'

// POST /api/auth/verify-email  { email, code }
export async function POST(request: Request) {
    try {
        const { email, code } = await request.json()

        if (!email || !code) {
            return NextResponse.json({ error: 'Email and code are required' }, { status: 400 })
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = await (prisma as any).user.findUnique({
            where: { email },
            select: {
                id: true,
                name: true,
                role: true,
                email: true,
                emailVerified: true,
                verificationCode: true,
                verificationExpiry: true,
                preferredLanguage: true,
            },
        })

        if (!user) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 })
        }

        if (user.emailVerified) {
            // Already verified — just log them in
            const tokenPayload = { userId: user.id, role: user.role, email: user.email }
            const token = await createToken(tokenPayload)
            const refresh = await createRefreshToken(tokenPayload)
            await setUserCookie(token, refresh)
            return NextResponse.json({ success: true, alreadyVerified: true })
        }

        if (!user.verificationCode || user.verificationCode !== code.trim()) {
            return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
        }

        if (!user.verificationExpiry || new Date() > new Date(user.verificationExpiry)) {
            return NextResponse.json({ error: 'Verification code has expired. Please request a new one.' }, { status: 400 })
        }

        // Mark email as verified and clear the code
        await prisma.user.update({
            where: { email },
            data: {
                emailVerified: true,
                verificationCode: null,
                verificationExpiry: null,
            },
        })

        // Log the user in
        const tokenPayload = { userId: user.id, role: user.role, email: user.email }
        const token = await createToken(tokenPayload)
        const refresh = await createRefreshToken(tokenPayload)
        await setUserCookie(token, refresh)

        // Send a welcome email + in-app notification in the user's preferred language (fire-and-forget)
        const locale = (user as any).preferredLanguage || 'en'
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
        const welcomeSubject = emailT('welcome', locale, 'subject') || emailT('welcome', locale, 'heading') || 'Welcome to AIM Studio! 🎬'
        welcomeEmailWithOverrides(user.name, siteUrl, locale)
            .then(html => sendEmail({
                to: user.email,
                subject: welcomeSubject,
                html,
            }))
            .catch(() => { /* never block the login response */ })

        // Write a localized in-app welcome notification (fire-and-forget)
        const welcomeTitle = emailT('welcome', locale, 'heading')?.replace('{name}', user.name)
            || `Welcome to AIM Studio, ${user.name}! 🎬`
        const welcomeMsg = emailT('welcome', locale, 'body')
            || "You're now part of our AI-powered filmmaking community. Explore casting calls, track your applications, and more."
        void notifyUser({
            userId: user.id,
            type: 'system',
            title: welcomeTitle,
            message: welcomeMsg,
            link: '/casting',
            // No emailHtml — in-app only; the welcome email was already sent above
            emailSubject: '',
        }).catch(() => {})

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Email verification error:', error)
        return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
    }
}

// PUT /api/auth/verify-email  { email }  — resend code
export async function PUT(request: Request) {
    try {
        const { email } = await request.json()
        if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userForResend = await prisma.user.findUnique({
            where: { email },
            select: { name: true, emailVerified: true, preferredLanguage: true } as any,
        }) as any
        if (!userForResend) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
        if (userForResend.emailVerified) return NextResponse.json({ error: 'Email already verified' }, { status: 400 })

        // Generate a fresh 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString()
        const expiry = new Date(Date.now() + 15 * 60 * 1000)

        await prisma.user.update({
            where: { email },
            data: {
                verificationCode: code,
                verificationExpiry: expiry,
            },
        })

        const resendLocale = userForResend.preferredLanguage || 'en'
        const html = await verificationEmailLocalized(userForResend.name, code, undefined, resendLocale)
        await sendEmail({
            to: email,
            subject: emailT('securityVerification', resendLocale, 'subject') || 'Verify your AIM Studio account',
            html,
        })

        console.log(`[DEV] Resent verification code for ${email}: ${code}`)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Resend code error:', error)
        return NextResponse.json({ error: 'Failed to resend code' }, { status: 500 })
    }
}
