// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance: capture 10% of traces in production, 100% in development
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session replay: 10% of sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [Sentry.replayIntegration()],

  // Filter out non-critical / network noise before sending to Sentry
  beforeSend(event) {
    const msg = event.message ?? ''
    const noisyPatterns = [
      /Network request failed/i,
      /ChunkLoadError/i,
      /Loading chunk/i,
      /ResizeObserver loop/i,
    ]
    if (noisyPatterns.some((re) => re.test(msg))) return null
    return event
  },
})
