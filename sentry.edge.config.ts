// sentry.edge.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  // Include IP and request headers in events
  sendDefaultPii: true,

  // Enable Sentry Logs for edge runtime
  enableLogs: true,
});
