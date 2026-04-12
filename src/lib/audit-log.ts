import { logger } from '@/lib/logger'

export type AuditAction =
    | 'DELETE_APPLICATIONS'
    | 'CHANGE_STATUS'
    | 'PROMOTE_USER'
    | 'DEMOTE_USER'
    | 'CREATE_ADMIN'
    | 'UPDATE_SETTINGS'
    | 'ROTATE_API_KEY'
    | 'DELETE_PROJECT'
    | 'DELETE_MEDIA'
    | 'DELETE_COURSE'
    | 'PREFERENCE_UPDATE'
    | 'TOKEN_ROTATE'

interface AuditEntry {
    actor: string       // userId of the admin performing the action
    action: AuditAction
    target: string      // raw resource ID(s) — kept for backward compat
    /** Human-readable summary stored in DB e.g. "47 applications (rejected)".
     *  Falls back to target if omitted. */
    targetSummary?: string
    details?: Record<string, unknown>
}

/**
 * Log a privileged admin action.
 * - Writes to the structured logger (Sentry breadcrumbs / Render logs)
 * - Persists to AdminAuditLog DB table for the admin UI audit panel
 */
export function logAdminAction({ actor, action, target, targetSummary, details }: AuditEntry): void {
    const summary = targetSummary ?? target

    const entry = {
        actor,
        action,
        target,
        timestamp: new Date().toISOString(),
        ...details,
    }
    logger.info('AUDIT', `${action} by ${actor} on ${summary}`, entry)
    console.log(`[AUDIT] ${action} | actor=${actor} | target=${summary}`, details ? JSON.stringify(details) : '')

    // Persist to DB — fire-and-forget, never blocks the request
    import('@/lib/db').then(({ prisma }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(prisma as any).adminAuditLog.create({
            data: { actor, action, targetSummary: summary, details: details ?? null },
        }).catch((err: unknown) => {
            logger.warn('AUDIT', 'Failed to persist audit log entry to DB', { error: err })
        })
    }).catch(() => {/* db import failed — already logged to console */})
}

/**
 * Compliance log for notification preference changes.
 * Writes a structured entry to the logger AND persists to PreferenceAudit table.
 * Retains entries for 90 days (enforced by cleanup_audit.ts cron script).
 */
export async function logPreferenceChange(
    userId: string,
    changedFields: Record<string, { from: unknown; to: unknown }>
): Promise<void> {
    try {
        const { prisma } = await import('@/lib/db')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).preferenceAudit.create({
            data: { userId, changedFields },
        })
    } catch (err) {
        // Non-fatal — log the error but don't block the request
        logger.warn('AUDIT', 'Failed to persist preference audit log', { error: err, userId })
    }
    logger.info('AUDIT', `PREFERENCE_UPDATE by ${userId}`, { changedFields })
    console.log(`[AUDIT] PREFERENCE_UPDATE | userId=${userId}`, JSON.stringify(changedFields))
}
