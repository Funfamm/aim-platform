import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * PATCH /api/admin/users/[id]/lock
 * Body: { action: 'suspend' | 'unsuspend' | 'unlock' }
 *
 * suspend   → sets suspended=true (manual ban — persists until admin unsuspends)
 * unsuspend → clears suspended flag
 * unlock    → clears lockedUntil + resets failedLoginAttempts (brute-force lockout)
 *
 * Every action is logged to the AuditLog table.
 */
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    let admin: { userId: string; email?: string; role: string } | null = null
    try { admin = await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { id } = await params
    const { action } = await req.json() as { action: 'suspend' | 'unsuspend' | 'unlock' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any

    // Never allow locking superadmins
    const target = await db.user.findUnique({ where: { id }, select: { role: true, email: true } })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (target.role === 'superadmin') return NextResponse.json({ error: 'Superadmin accounts cannot be locked' }, { status: 403 })

    let data: Record<string, unknown> = {}
    let message = ''

    if (action === 'suspend') {
        data = { suspended: true }
        message = `Account suspended: ${target.email}`
    } else if (action === 'unsuspend') {
        data = { suspended: false }
        message = `Account unsuspended: ${target.email}`
    } else if (action === 'unlock') {
        data = { lockedUntil: null, failedLoginAttempts: 0 }
        message = `Account unlocked: ${target.email}`
    } else {
        return NextResponse.json({ error: 'Invalid action. Use: suspend | unsuspend | unlock' }, { status: 400 })
    }

    const updated = await db.user.update({
        where: { id },
        data,
        select: { id: true, email: true, suspended: true, lockedUntil: true, failedLoginAttempts: true },
    })

    // Write audit log row — fire-and-forget, never block the response
    db.auditLog.create({
        data: {
            adminId: admin?.userId ?? 'unknown',
            adminEmail: admin?.email ?? 'unknown',
            action,
            targetType: 'user',
            targetId: id,
            targetEmail: target.email,
        },
    }).catch((err: unknown) => logger.error('audit', `Failed to write audit log for ${action}`, { error: err }))

    logger.info('admin/lock', `[${admin?.email}] ${message}`)
    return NextResponse.json({ ok: true, message, user: updated })
}
