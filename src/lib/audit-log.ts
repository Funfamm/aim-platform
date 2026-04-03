/**
 * Admin audit log — records who did what and when.
 *
 * All destructive admin actions should be logged here for
 * accountability and incident investigation.
 */

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
    target: string      // resource ID(s) affected
    details?: Record<string, unknown>
}

/**
 * Log a privileged admin action.
 * Writes to the structured logger with the [AUDIT] category.
 */
export function logAdminAction({ actor, action, target, details }: AuditEntry): void {
    const entry = {
        actor,
        action,
        target,
        timestamp: new Date().toISOString(),
        ...details,
    }
    logger.info('AUDIT', `${action} by ${actor} on ${target}`, entry)

    // Also log to console so it appears in Render logs / Sentry breadcrumbs
    console.log(`[AUDIT] ${action} | actor=${actor} | target=${target}`, details ? JSON.stringify(details) : '')
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
