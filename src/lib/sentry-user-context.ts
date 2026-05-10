/**
 * Sentry User Context
 * -------------------
 * Call setSentryUser() after a successful authentication to attach user identity
 * to all subsequent Sentry events and replays in that session.
 * Call clearSentryUser() on logout.
 */
import * as Sentry from '@sentry/nextjs'

export function setSentryUser(user: {
    id: string
    email?: string
    role?: string
}) {
    Sentry.setUser({
        id: user.id,
        email: user.email,
        // Custom tag — useful for filtering errors by admin vs regular user
        ...(user.role ? { role: user.role } : {}),
    })
}

export function clearSentryUser() {
    Sentry.setUser(null)
}
