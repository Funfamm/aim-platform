import { NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import { prisma } from '@/lib/db'
import { createToken, createRefreshToken, setUserCookie } from '@/lib/auth'
import { authLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
    const blocked = authLimiter.check(request)
    if (blocked) return blocked

    try {
        const { email, password } = await request.json()

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
        }

        const normalizedEmail = email.toLowerCase().trim()

        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        })
        if (!user || !user.passwordHash) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
        }

        const valid = await compare(password, user.passwordHash)
        if (!valid) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
        }

        // Block login if email not yet verified
        const userDetail = await prisma.user.findUnique({
            where: { id: user.id },
            select: { emailVerified: true, tokenVersion: true },
        })
        const isVerified = userDetail?.emailVerified === true
        const tokenVersion = userDetail?.tokenVersion ?? 0

        if (!isVerified) {
            return NextResponse.json({ error: 'Please verify your email before logging in.', requiresVerification: true, email: user.email }, { status: 403 })
        }

        const tokenPayload = { userId: user.id, role: user.role, email: user.email, tokenVersion }
        const token = await createToken(tokenPayload)
        const refresh = await createRefreshToken(tokenPayload)
        await setUserCookie(token, refresh)

        // Role-based redirect: admins/superadmins → /admin, members → /dashboard
        const redirectTo = (user.role === 'admin' || user.role === 'superadmin') ? '/admin' : '/dashboard'

        return NextResponse.json({
            user: {
                id: user.id, name: user.name, email: user.email,
                avatar: user.avatar, bannerUrl: user.bannerUrl, role: user.role,
            },
            redirectTo,
        })
    } catch (error) {
        logger.error('auth/login', 'Login failed', { error })
        return NextResponse.json({ error: 'Login failed' }, { status: 500 })
    }
}
