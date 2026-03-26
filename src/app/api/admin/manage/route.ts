import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requireSuperAdmin, createToken, createRefreshToken, setUserCookie } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { hash, compare } from 'bcryptjs'

// GET — list all admin/superadmin users (any admin can view)
export async function GET() {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const admins = await prisma.user.findMany({
        where: { role: { in: ['admin', 'superadmin'] } },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ admins })
}

// POST — promote a user to admin (superadmin only)
export async function POST(request: NextRequest) {
    try {
        await requireSuperAdmin()
    } catch {
        return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
    }

    const { userId, role } = await request.json()

    if (!userId || !role) {
        return NextResponse.json({ error: 'userId and role are required' }, { status: 400 })
    }

    if (!['admin', 'member'].includes(role)) {
        return NextResponse.json({ error: 'Can only set role to admin or member' }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } })
    if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Cannot change another superadmin's role
    if (targetUser.role === 'superadmin') {
        return NextResponse.json({ error: 'Cannot modify a superadmin' }, { status: 403 })
    }

    await prisma.user.update({ where: { id: userId }, data: { role } })

    return NextResponse.json({
        success: true,
        message: `${targetUser.name} is now ${role === 'admin' ? 'an admin' : 'a member'}`,
    })
}

// PATCH — superadmin updates own credentials (name, password)
export async function PATCH(request: NextRequest) {
    let session
    try {
        session = await requireSuperAdmin()
    } catch {
        return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
    }

    const { name, currentPassword, newPassword } = await request.json()
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {}

    // Update name
    if (name?.trim()) {
        updateData.name = name.trim()
    }

    // Update password
    if (newPassword) {
        if (!currentPassword) {
            return NextResponse.json({ error: 'Current password is required to change password' }, { status: 400 })
        }
        if (newPassword.length < 6) {
            return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })
        }

        const user = await prisma.user.findUnique({ where: { id: session.userId } })
        if (!user?.passwordHash) {
            return NextResponse.json({ error: 'Cannot change password' }, { status: 400 })
        }

        const valid = await compare(currentPassword, user.passwordHash)
        if (!valid) {
            return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
        }

        updateData.passwordHash = await hash(newPassword, 12)
    }

    if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
    }

    const updated = await prisma.user.update({
        where: { id: session.userId },
        data: updateData,
        select: { id: true, name: true, email: true, role: true },
    })

    // Refresh token with updated name if name changed
    if (updateData.name) {
        // Fetch tokenVersion via raw query (not yet in generated types)
        const tvRows = await prisma.$queryRaw<{ tokenVersion: number }[]>`SELECT "tokenVersion" FROM "User" WHERE "id" = ${updated.id}`
        const tokenVersion = tvRows[0]?.tokenVersion ?? 0
        const tokenPayload = {
            userId: updated.id,
            role: updated.role,
            email: updated.email,
            tokenVersion,
        }
        const token = await createToken(tokenPayload)
        const refresh = await createRefreshToken(tokenPayload)
        await setUserCookie(token, refresh)
    }

    return NextResponse.json({
        success: true,
        message: 'Credentials updated successfully',
        name: updated.name,
    })
}

// PUT — create a new power admin with credentials (superadmin only)
export async function PUT(request: NextRequest) {
    try {
        await requireSuperAdmin()
    } catch {
        return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
    }

    const { name, email, password } = await request.json()

    if (!name?.trim() || !email?.trim() || !password) {
        return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 })
    }

    if (password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email: email.trim() } })
    if (existing) {
        // If exists, just promote to admin
        if (existing.role === 'admin' || existing.role === 'superadmin') {
            return NextResponse.json({ error: 'User is already an admin' }, { status: 400 })
        }
        await prisma.user.update({
            where: { id: existing.id },
            data: { role: 'admin', name: name.trim(), emailVerified: true },
        })
        return NextResponse.json({
            success: true,
            message: `${name} promoted to power admin`,
            admin: { id: existing.id, name: name.trim(), email: existing.email, role: 'admin' },
        })
    }

    // Create new admin user — pre-verified since super admin created them directly
    const passwordHash = await hash(password, 12)
    const newAdmin = await prisma.user.create({
        data: {
            name: name.trim(),
            email: email.trim(),
            passwordHash,
            role: 'admin',
            emailVerified: true,
        },
    })

    return NextResponse.json({
        success: true,
        message: `Power admin ${name} created`,
        admin: { id: newAdmin.id, name: newAdmin.name, email: newAdmin.email, role: 'admin' },
    })
}

// DELETE — demote an admin to member (superadmin only)
export async function DELETE(request: NextRequest) {
    let session
    try {
        session = await requireSuperAdmin()
    } catch {
        return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
    }

    const { userId } = await request.json()

    if (!userId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Cannot demote yourself
    if (userId === session.userId) {
        return NextResponse.json({ error: 'Cannot demote yourself' }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } })
    if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Cannot demote another superadmin
    if (targetUser.role === 'superadmin') {
        return NextResponse.json({ error: 'Cannot demote a superadmin' }, { status: 403 })
    }

    // Guard: ensure at least 1 superadmin always exists
    if (targetUser.role === 'admin') {
        const adminCount = await prisma.user.count({ where: { role: { in: ['admin', 'superadmin'] } } })
        if (adminCount <= 1) {
            return NextResponse.json({ error: 'Cannot demote: at least one admin must exist' }, { status: 400 })
        }
    }

    await prisma.user.update({ where: { id: userId }, data: { role: 'member' } })

    return NextResponse.json({
        success: true,
        message: `${targetUser.name} has been demoted to member`,
    })
}
