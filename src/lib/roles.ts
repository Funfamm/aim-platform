/**
 * roles.ts — Centralized role constants for the AIM Platform.
 *
 * Single source of truth. Import from here everywhere instead of
 * using hard-coded strings like 'admin' or 'superadmin'.
 */

export const ADMIN_ROLES = ['admin', 'superadmin'] as const
export type AdminRole = typeof ADMIN_ROLES[number]

/** Returns true if the given role string is an admin role. */
export function hasAdminRole(role?: string | null): role is AdminRole {
    return ADMIN_ROLES.includes(role as AdminRole)
}

export const MEMBER_ROLE = 'member' as const
export const ALL_ROLES = [...ADMIN_ROLES, MEMBER_ROLE] as const
