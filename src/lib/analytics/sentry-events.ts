/**
 * Sentry Engagement Events
 * ------------------------
 * Custom Sentry breadcrumbs and spans for key engagement flows.
 * These appear in Sentry's Issues timeline and Session Replays.
 *
 * Usage:
 *   import { trackVideoPlay } from '@/lib/analytics/sentry-events'
 *   trackVideoPlay({ projectId: '123', title: 'My Film' })
 */
import * as Sentry from '@sentry/nextjs'

/** Track when a user starts playing a video */
export function trackVideoPlay(opts: { projectId: string; title: string; type?: string }) {
    Sentry.addBreadcrumb({
        category: 'engagement.video',
        message: `Video play: ${opts.title}`,
        level: 'info',
        data: opts,
    })
}

/** Track video completion (watched >90%) */
export function trackVideoComplete(opts: { projectId: string; title: string }) {
    Sentry.addBreadcrumb({
        category: 'engagement.video',
        message: `Video complete: ${opts.title}`,
        level: 'info',
        data: opts,
    })
}

/** Track auth events (login, register, logout) */
export function trackAuthEvent(type: 'login' | 'register' | 'logout' | 'login_failed', method?: string) {
    Sentry.addBreadcrumb({
        category: 'auth',
        message: `Auth event: ${type}`,
        level: type === 'login_failed' ? 'warning' : 'info',
        data: { method },
    })
}

/** Track donation/payment events */
export function trackDonation(opts: { amount: number; currency: string; status: 'initiated' | 'completed' | 'failed' }) {
    Sentry.addBreadcrumb({
        category: 'engagement.donation',
        message: `Donation ${opts.status}: ${opts.currency} ${opts.amount}`,
        level: opts.status === 'failed' ? 'error' : 'info',
        data: opts,
    })
}

/** Track casting submission */
export function trackCastingSubmit(opts: { callId: string; status: 'submitted' | 'failed' }) {
    Sentry.addBreadcrumb({
        category: 'engagement.casting',
        message: `Casting submission ${opts.status}`,
        level: opts.status === 'failed' ? 'error' : 'info',
        data: opts,
    })
}

/** Track subscription sign-ups */
export function trackSubscription(opts: { status: 'subscribed' | 'unsubscribed' | 'failed'; source?: string }) {
    Sentry.addBreadcrumb({
        category: 'engagement.subscription',
        message: `Subscription ${opts.status}`,
        level: 'info',
        data: opts,
    })
}
