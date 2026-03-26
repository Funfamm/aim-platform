// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // Adjust this value in production
  tracesSampleRate: 1.0,
  // You can add more client‑side options here
});
