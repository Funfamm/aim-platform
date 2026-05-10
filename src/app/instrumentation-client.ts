// instrumentation-client.ts – full Sentry v9 client-side initialisation
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  // Performance: 20% in production so LCP/FCP/TTFB pageload spans are visible
  // Seer confirmed 0 frontend pageload spans at 10% — raised to 20%
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  // Session replay: 10% of sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration(),
    // Track page navigation performance (route changes, LCP, FID, etc.)
    Sentry.browserTracingIntegration(),
    // User feedback widget — appears automatically on errors
    Sentry.feedbackIntegration({
      colorScheme: 'dark',
      buttonLabel: 'Report a bug',
      submitButtonLabel: 'Send Report',
      formTitle: 'Report an Issue',
    }),
  ],

  // Enable Sentry Logs — pipes logger.info/warn calls into Explore > Logs
  _experiments: { enableLogs: true },

  // Filter out non-critical / network noise before sending to Sentry
  beforeSend(event) {
    const msg = event.message ?? event.exception?.values?.[0]?.value ?? ''
    const noisyPatterns = [
      /Network request failed/i,
      /ChunkLoadError/i,
      /Loading chunk/i,
      /ResizeObserver loop/i,
      /Non-Error promise rejection/i,
    ]
    if (noisyPatterns.some((re) => re.test(msg))) return null
    return event
  },
});
