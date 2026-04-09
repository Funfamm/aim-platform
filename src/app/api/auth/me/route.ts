import { NextResponse } from 'next/server'
import { getSessionAndRefresh } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
    const session = await getSessionAndRefresh()
    if (!session?.userId) {
        return NextResponse.json({ user: null }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
        where: { id: session.userId as string },
        select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            bannerUrl: true,
            role: true,
            emailVerified: true,
            passwordHash: true,
            googleId: true,
            appleId: true,
            accentColor: true,
            themeMode: true,
        },
    })

    if (!user) {
        return NextResponse.json({ user: null }, { status: 401 })
    }

    // Expose auth metadata without leaking the actual hash
    const { passwordHash, googleId, appleId, ...safeUser } = user
    return NextResponse.json({
        user: {
            ...safeUser,
            hasPassword: !!passwordHash,
            authProvider: googleId ? 'google' : appleId ? 'apple' : 'credentials',
        },
    })
}
