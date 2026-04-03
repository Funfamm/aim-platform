/**
 * POST /api/auth/rotate
 * ---------------------------------------------------------------------------
 * Admin-triggered emergency token rotation.
 * Increments tokenVersion for a target user (or all users if no userId given).
 * All existing tokens become invalid immediately.
 *
 * Only callable by superadmin.
 * Body: { userId?: string }  — omit to rotate ALL users (nuclear option).
 *
 * Audit: every rotation is logged via logAdminAction.
 */
import { NextResponse } from 'next/server'
import { getSessionAndRefresh } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logAdminAction } from '@/lib/audit-log'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
    const session = await getSessionAndRefresh()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actor = session as any
    if (!actor?.userId && !actor?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const actorId: string = actor.userId || actor.id

    // Superadmin only
    if (actor.role !== 'superadmin') {
        return NextResponse.json({ error: 'Forbidden — superadmin required' }, { status: 403 })
    }

    try {
        const body = await request.json().catch(() => ({})) as { userId?: string }
        const targetId = body.userId

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any

        if (targetId) {
            // Rotate a single user
            await db.user.update({
                where: { id: targetId },
                data: { tokenVersion: { increment: 1 } },
            })
            logAdminAction({ actor: actorId, action: 'TOKEN_ROTATE', target: targetId })
            logger.info('auth/rotate', `Token rotated for user ${targetId} by ${actorId}`)

            return NextResponse.json({ success: true, rotated: 1 })
        } else {
            // Rotate ALL users (emergency nuclear option)
            const result = await db.user.updateMany({ data: { tokenVersion: { increment: 1 } } })
            logAdminAction({ actor: actorId, action: 'TOKEN_ROTATE', target: 'ALL_USERS', details: { count: result.count } })
            logger.warn('auth/rotate', `Emergency token rotation for ALL ${result.count} users by ${actorId}`)

            return NextResponse.json({ success: true, rotated: result.count })
        }
    } catch (error) {
        logger.error('auth/rotate', 'Token rotation failed', { error })
        return NextResponse.json({ error: 'Rotation failed' }, { status: 500 })
    }
}
