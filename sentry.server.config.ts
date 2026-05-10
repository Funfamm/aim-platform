// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Capture 20% of traces in production — enough for meaningful data without quota burn
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

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
    // Skip connection pool timeouts that are transient — already alerted via DB metrics
    if (event.exception?.values?.some(v =>
      v.value?.includes('connection pool') ||
      v.value?.includes('Too many login attempts') ||
      v.value?.includes('Temporary System Problem')
    )) {
      // Still send but with low priority fingerprint
      event.fingerprint = ['transient-infrastructure', event.exception.values[0]?.type ?? 'unknown']
    }
    return event
  },
});
