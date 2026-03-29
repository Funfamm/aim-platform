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
