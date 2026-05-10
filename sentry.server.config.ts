// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Smart sampling per route — cron routes fire every 15min so 5% is plenty;
  // admin routes get 30% for deeper visibility; user-facing pages at 20%
  tracesSampler: ({ name }: { name: string }) => {
    if (name.includes('/api/cron/')) return process.env.NODE_ENV === 'production' ? 0.05 : 1.0
    if (name.includes('/api/admin/')) return process.env.NODE_ENV === 'production' ? 0.3 : 1.0
    return process.env.NODE_ENV === 'production' ? 0.2 : 1.0
  },

  // CPU profiling: 10% of sampled traces get full profiles
  profilesSampleRate: 0.1,

  // Include IP, request headers, and user data in events
  sendDefaultPii: true,

  // Attach local variable values to stack frames — makes errors much easier to debug
  includeLocalVariables: true,

  // Enable Sentry Logs — server-side logger.info/warn visible in Explore > Logs
  enableLogs: true,

  integrations: [
    // Track slow Prisma queries as spans
    Sentry.prismaIntegration(),
  ],

  // Filter out noisy non-actionable errors
  beforeSend(event) {
    // P2002 = unique constraint violation (e.g. duplicate slug) — user input error, not a system error
    const isP2002 = event.exception?.values?.some(v =>
      v.value?.includes('Unique constraint failed')
    )
    if (isP2002) return null

    // Neon cold start — transient; group into one issue rather than spamming
    const isNeonColdStart = event.exception?.values?.some(v =>
      v.value?.includes("Can't reach database server")
    )

    // Skip connection pool timeouts that are transient — already alerted via DB metrics
    const isTransientInfra = event.exception?.values?.some(v =>
      v.value?.includes('connection pool') ||
      v.value?.includes('Too many login attempts') ||
      v.value?.includes('Temporary System Problem')
    )

    if (isNeonColdStart || isTransientInfra) {
      event.fingerprint = ['transient-infrastructure', event.exception?.values?.[0]?.type ?? 'unknown']
    }
    return event
  },
});
