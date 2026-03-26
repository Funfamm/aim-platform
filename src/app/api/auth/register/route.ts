import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/db'
import { authLimiter } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/mailer'
import { verificationEmail, welcomeEmailWithOverrides } from '@/lib/email-templates'

export async function POST(request: Request) {
    const blocked = authLimiter.check(request)
    if (blocked) return blocked

    try {
        const { name, email, password } = await request.json()

        if (!name || !email || !password) {
            return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 })
        }

        if (password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
        }

        // Check if user exists
        const existing = await prisma.user.findUnique({ where: { email } })
        if (existing) {
            // If they exist but never verified, resend a new code
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (!(existing as any).emailVerified) {
                const code = Math.floor(100000 + Math.random() * 900000).toString()
                const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString()
                await prisma.$executeRaw`UPDATE "User" SET "verificationCode" = ${code}, "verificationExpiry" = ${expiry} WHERE "email" = ${email}`
                sendEmail({ to: email, subject: 'Verify your AIM Studio account', html: verificationEmail(existing.name, code) })
                console.log(`[DEV] Re-sent verification code for ${email}: ${code}`)
                return NextResponse.json({ requiresVerification: true, email }, { status: 200 })
            }
            return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
        }

        // Generate 6-digit OTP
        const code = Math.floor(100000 + Math.random() * 900000).toString()
        const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString()

        // Create user with core fields (avoids stale type-cache issues with new columns)
        const passwordHash = await hash(password, 12)
        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                passwordHash,
                role: 'member',
            },
        })

        // Set verification fields via raw SQL (new columns not yet in compiled types)
        await prisma.$executeRaw`UPDATE "User" SET "emailVerified" = 0, "verificationCode" = ${code}, "verificationExpiry" = ${expiry} WHERE "id" = ${newUser.id}`

        // Send verification email (fire-and-forget)
        sendEmail({
            to: email,
            subject: 'Verify your AIM Studio account',
            html: verificationEmail(name, code),
        })

        // Always log in dev so it works without SMTP
        console.log(`[DEV] Email verification code for ${email}: ${code}`)

        return NextResponse.json({ requiresVerification: true, email })
    } catch (error) {
        console.error('Registration error:', error)
        return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
    }
}
