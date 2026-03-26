import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const url = request.nextUrl
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25')))
    const search = (url.searchParams.get('search') || '').trim()
    const role = url.searchParams.get('role') || ''
    const sort = url.searchParams.get('sort') || 'newest'

    const where: Record<string, unknown> = {}
    if (search) {
        where.OR = [
            { name: { contains: search } },
            { email: { contains: search } },
        ]
    }
    if (role && role !== 'all') where.role = role

    const orderBy = sort === 'oldest' ? { createdAt: 'asc' as const }
        : sort === 'name' ? { name: 'asc' as const }
        : { createdAt: 'desc' as const }

    const [users, total, totalMembers, totalAdmins, totalSuperadmins, totalWithApps] = await Promise.all([
        prisma.user.findMany({
            where, orderBy,
            skip: (page - 1) * limit, take: limit,
            select: {
                id: true, name: true, email: true, role: true, createdAt: true,
                passwordHash: true, googleId: true, appleId: true,
                _count: { select: { applications: true, donations: true } },
            },
        }),
        prisma.user.count({ where }),
        prisma.user.count({ where: { role: 'member' } }),
        prisma.user.count({ where: { role: 'admin' } }),
        prisma.user.count({ where: { role: 'superadmin' } }),
        prisma.user.count({ where: { applications: { some: {} } } }),
    ])

    return NextResponse.json({
        users: users.map(u => {
            // Derive auth provider from which identifiers are set
            const hasEmail = !!u.passwordHash
            const hasGoogle = !!u.googleId
            const hasApple = !!u.appleId
            const count = [hasEmail, hasGoogle, hasApple].filter(Boolean).length
            const authProvider = count > 1 ? 'multiple'
                : hasGoogle ? 'google'
                : hasApple ? 'apple'
                : 'email'
            return {
                id: u.id, name: u.name, email: u.email, role: u.role,
                applications: u._count.applications, donations: u._count.donations,
                createdAt: u.createdAt.toISOString(),
                authProvider,
            }
        }),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        stats: { total, members: totalMembers, admins: totalAdmins, superadmins: totalSuperadmins, withApplications: totalWithApps },
    })
}

export async function DELETE(request: NextRequest) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const { ids } = await request.json() as { ids: string[] }
        if (!ids || ids.length === 0) return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })

        // Never delete superadmins via bulk delete
        const deleted = await prisma.user.deleteMany({
            where: { id: { in: ids }, role: { not: 'superadmin' } },
        })
        return NextResponse.json({ deleted: deleted.count })
    } catch (err) {
        console.error('Bulk delete users error:', err)
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
    }
}

