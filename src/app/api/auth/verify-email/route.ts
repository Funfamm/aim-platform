import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createToken, createRefreshToken, setUserCookie } from '@/lib/auth'
import { sendEmail } from '@/lib/mailer'
import { welcomeEmail } from '@/lib/email-templates'

// No separate type needed – we use Prisma's User type directly

// POST /api/auth/verify-email  { email, code }
export async function POST(request: Request) {
    try {
        const { email, code } = await request.json()

        if (!email || !code) {
            return NextResponse.json({ error: 'Email and code are required' }, { status: 400 })
        }

        const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          role: true,
          email: true,
          emailVerified: true,
          verificationCode: true,
          verificationExpiry: true,
        },
      })
      if (!user) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 })
      }

        const user = rows[0]
        const isVerified = !!user.emailVerified;

        if (isVerified) {
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

        // Mark email as verified and clear the code via raw SQL
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

        // Send a welcome email now that account is fully verified (fire-and-forget)
        sendEmail({
            to: user.email,
            subject: 'Welcome to AIM Studio! 🎬',
            html: welcomeEmail(user.name, process.env.NEXT_PUBLIC_SITE_URL),
        }).catch(() => { /* never block the login response */ })

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

        const rows = await prisma.$queryRaw<VerificationRow[]>`
            SELECT "id", "name", "emailVerified" FROM "User" WHERE "email" = ${email}
        `
        if (!rows.length) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

        const isVerified = !!user.emailVerified
        if (isVerified) return NextResponse.json({ error: 'Email already verified' }, { status: 400 })

        // Generate a fresh 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString()
        const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString()

        await prisma.user.update({
        where: { email },
        data: {
          verificationCode: code,
          verificationExpiry: new Date(expiry),
        },
      })

        const { sendEmail } = await import('@/lib/mailer')
        const { verificationEmail } = await import('@/lib/email-templates')
        await sendEmail({
            to: email,
            subject: 'Your AIM Studio verification code',
            html: verificationEmail(user.name, code),
        })

        console.log(`[DEV] Resent verification code for ${email}: ${code}`)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Resend code error:', error)
        return NextResponse.json({ error: 'Failed to resend code' }, { status: 500 })
    }
}
