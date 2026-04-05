import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateDeletedEmail } from '@/lib/utils';

export async function GET(request: NextRequest) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const url = request.nextUrl
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25')))
    const search = (url.searchParams.get('search') || '').trim()
    const role = url.searchParams.get('role') || ''
    const language = url.searchParams.get('language') || ''
    const sort = url.searchParams.get('sort') || 'newest'

    const where: Record<string, unknown> = {}
    if (search) {
        where.OR = [
            { name: { contains: search } },
            { email: { contains: search } },
        ]
    }
    if (role && role !== 'all') where.role = role
    if (language && language !== 'all') where.preferredLanguage = language

    const orderBy = sort === 'oldest' ? { createdAt: 'asc' as const }
        : sort === 'name' ? { name: 'asc' as const }
        : { createdAt: 'desc' as const }

    const [usersRaw, total, totalMembers, totalAdmins, totalSuperadmins, totalWithApps] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prisma as any).user.findMany({
            where, orderBy,
            skip: (page - 1) * limit, take: limit,
            select: {
                id: true, name: true, email: true, role: true, createdAt: true,
                passwordHash: true, googleId: true, appleId: true, preferredLanguage: true,
                _count: { select: { applications: true, donations: true } },
            },
        }),
        prisma.user.count({ where }),
        prisma.user.count({ where: { role: 'member' } }),
        prisma.user.count({ where: { role: 'admin' } }),
        prisma.user.count({ where: { role: 'superadmin' } }),
        prisma.user.count({ where: { applications: { some: {} } } }),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const users = usersRaw as any[];

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
                preferredLanguage: u.preferredLanguage,
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

        // Fetch users to delete including their email for anonymization
        const usersToDelete = await prisma.user.findMany({
            where: { id: { in: ids }, role: { not: 'superadmin' } },
            select: { id: true, email: true },
        })
        const safeIds = usersToDelete.map(u => u.id)
        if (safeIds.length === 0) return NextResponse.json({ error: 'No eligible users to delete' }, { status: 400 })

        // Map user id -> anonymized email
        const anonMap = new Map<string, string>()
        usersToDelete.forEach(u => anonMap.set(u.id, generateDeletedEmail(u.id, u.email)))

        // Cascade-clear and anonymize all user data systematically in a transaction
        await prisma.$transaction(async (tx) => {
            // 1a. Guest applications: anonymise email based on original email (no userId)
            for (const u of usersToDelete) {
                const anonEmail = anonMap.get(u.id)!;
                await tx.application.updateMany({
                    where: { email: u.email },
                    data: { email: anonEmail },
                });
            }
            // 1. Applications: Unlink user and anonymize email for linked records
            for (const [uid, anonEmail] of anonMap.entries()) {
                await tx.application.updateMany({
                    where: { userId: uid },
                    data: { userId: null, email: anonEmail },
                });
            }

            // 2. Donations: Preserve financial records, unlink user and anonymize
            for (const [uid, anonEmail] of anonMap.entries()) {
                await tx.donation.updateMany({
                    where: { userId: uid },
                    data: { userId: null, email: anonEmail },
                })
            }

            // 3. Script Submissions: Anonymize based on original email
            for (const u of usersToDelete) {
                const anonEmail = anonMap.get(u.id)!
                await tx.scriptSubmission.updateMany({
                    where: { authorEmail: u.email },
                    data: { authorEmail: anonEmail },
                })
            }

            // 4. Delete users — this triggers Cascade for all related models with onDelete: Cascade
            await tx.user.deleteMany({
                where: { id: { in: safeIds } },
            })
        })

        return NextResponse.json({ deleted: safeIds.length, message: `${safeIds.length} user(s) and all related records have been permanently anonymized and removed.` })
    } catch (err) {
        console.error('Bulk delete users error:', err)
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
    }
}


