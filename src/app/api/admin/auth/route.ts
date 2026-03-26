import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

// POST — Legacy admin login endpoint. Now redirects through unified auth.
// Kept for backward compatibility but no longer sets admin_token.
export async function POST() {
    return NextResponse.json({
        error: 'Admin login has moved to /login. Please use your email and password.',
        redirect: '/login',
    }, { status: 410 })
}

// PUT — Change password (admin/superadmin only)
export async function PUT(request: NextRequest) {
    let session
    try { session = await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const { newPassword } = await request.json()
        if (!newPassword || newPassword.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
        }

        const hashed = await bcrypt.hash(newPassword, 10)

        await prisma.user.update({
            where: { id: session.userId },
            data: { passwordHash: hashed },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Password update error:', error)
        return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
    }
}
