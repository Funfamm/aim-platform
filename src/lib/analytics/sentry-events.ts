/**
 * Sentry Engagement Events
 * ------------------------
 * Custom Sentry spans and measurements for key engagement flows.
 * These appear in Sentry Performance and can be used to build custom dashboards.
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
    Sentry.metrics.increment('video.play', 1, {
        tags: { project_id: opts.projectId, type: opts.type ?? 'unknown' },
    })
}

/** Track video completion (watched >90%) */
export function trackVideoComplete(opts: { projectId: string; title: string }) {
    Sentry.metrics.increment('video.complete', 1, {
        tags: { project_id: opts.projectId },
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
    Sentry.metrics.increment(`auth.${type}`, 1, {
        tags: { method: method ?? 'unknown' },
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
    Sentry.metrics.increment(`donation.${opts.status}`, 1, {
        tags: { currency: opts.currency },
    })
    if (opts.status === 'completed') {
        Sentry.metrics.distribution('donation.amount', opts.amount, {
            unit: 'none',
            tags: { currency: opts.currency },
        })
    }
}

/** Track casting submission */
export function trackCastingSubmit(opts: { callId: string; status: 'submitted' | 'failed' }) {
    Sentry.addBreadcrumb({
        category: 'engagement.casting',
        message: `Casting submission ${opts.status}`,
        level: opts.status === 'failed' ? 'error' : 'info',
        data: opts,
    })
    Sentry.metrics.increment(`casting.${opts.status}`, 1, {
        tags: { call_id: opts.callId },
    })
}

/** Track subscription sign-ups */
export function trackSubscription(opts: { status: 'subscribed' | 'unsubscribed' | 'failed'; source?: string }) {
    Sentry.metrics.increment(`subscription.${opts.status}`, 1, {
        tags: { source: opts.source ?? 'unknown' },
    })
}
