/**
 * Prometheus Metrics Helper
 * ---------------------------------------------------------------------------
 * Exposes counters and gauges for key platform events.
 * Used by /api/metrics endpoint for Grafana/Prometheus scraping.
 *
 * Guards against the prom-client module being absent in environments
 * where it hasn't been installed yet (CI-safe).
 *
 * Metrics:
 *   auth_success_total       – successful logins (by role)
 *   auth_failure_total       – failed logins (by reason)
 *   notification_jobs_total  – notification queue jobs (by status)
 *   request_duration_ms      – HTTP request latency histogram
 */

// We use a dynamic require to avoid breaking builds when prom-client is absent
let registry: { contentType: string; metrics: () => Promise<string> } | null = null

type PrometheusCounter = { inc: (labels?: Record<string, string>) => void }
type PrometheusHistogram = { observe: (labels: Record<string, string>, value: number) => void }

const counters: Record<string, PrometheusCounter> = {}
const histograms: Record<string, PrometheusHistogram> = {}


try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const prom = require('prom-client')
    prom.collectDefaultMetrics({ prefix: 'aim_' })

    registry = prom.register

    counters.authSuccess = new prom.Counter({
        name: 'aim_auth_success_total',
        help: 'Total successful logins',
        labelNames: ['role'],
    })

    counters.authFailure = new prom.Counter({
        name: 'aim_auth_failure_total',
        help: 'Total failed login attempts',
        labelNames: ['reason'],
    })

    counters.notificationJobs = new prom.Counter({
        name: 'aim_notification_jobs_total',
        help: 'Total notification queue jobs processed',
        labelNames: ['status', 'type'],
    })

    counters.csrfRejected = new prom.Counter({
        name: 'aim_csrf_rejected_total',
        help: 'Total CSRF token rejections',
    })

    histograms.requestDuration = new prom.Histogram({
        name: 'aim_request_duration_ms',
        help: 'HTTP request duration in milliseconds',
        labelNames: ['method', 'path', 'status'],
        buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000],
    })
} catch {
    // prom-client not installed — metrics silently disabled
}

/** Record a successful login */
export function recordAuthSuccess(role: string) {
    if (counters.authSuccess) counters.authSuccess.inc({ role })
}

/** Record a failed login */
export function recordAuthFailure(reason: 'invalid_credentials' | 'mfa_failed' | 'unverified' | 'rate_limited') {
    if (counters.authFailure) counters.authFailure.inc({ reason })
}

/** Record a notification queue job outcome */
export function recordNotificationJob(status: 'completed' | 'failed', type: string) {
    if (counters.notificationJobs) counters.notificationJobs.inc({ status, type })
}

/** Record a CSRF rejection */
export function recordCsrfRejection() {
    if (counters.csrfRejected) counters.csrfRejected.inc()
}

/** Observe a request duration */
export function observeRequestDuration(method: string, path: string, statusCode: number, durationMs: number) {
    if (histograms.requestDuration) histograms.requestDuration.observe({ method, path, status: String(statusCode) }, durationMs)
}

/** Return Prometheus text format for /api/metrics */
export async function getMetricsOutput(): Promise<{ contentType: string; body: string } | null> {
    if (!registry) return null
    return {
        contentType: registry.contentType,
        body: await registry.metrics(),
    }
}
