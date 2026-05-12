// instrumentation-client.ts – full Sentry v9 client-side initialisation
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  // Include IP and user data in events
  sendDefaultPii: true,

  // Performance: 20% in production so LCP/FCP/TTFB pageload spans are visible
  // Seer confirmed 0 frontend pageload spans at 10% — raised to 20%
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  // Propagate trace headers to these services so browser→server→external spans connect
  tracePropagationTargets: [
    'localhost',
    /^https:\/\/impactaistudio\.com/,
    /^https:\/\/graph\.microsoft\.com/,
    /^https:\/\/.*\.r2\.cloudflarestorage\.com/,
    /^https:\/\/.*\.livekit\.cloud/,
  ],

  // Session replay: 10% of sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Enable Sentry Logs — pipes logger.info/warn calls into Explore > Logs
  enableLogs: true,

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

  // Filter out non-critical / network noise before sending to Sentry
  beforeSend(event) {
    const msg = event.message ?? event.exception?.values?.[0]?.value ?? ''
    const noisyPatterns = [
      /Network request failed/i,
      /ChunkLoadError/i,
      /Loading chunk/i,
      /ResizeObserver loop/i,
      /Non-Error promise rejection/i,
      // Facebook/Instagram In-App Browser noise:
      // Android: WebView loses its native Java bridge on app switch / GC
      // iOS: WebKit message handlers undefined in non-native context
      /Java object is gone/i,
      /postMessage.*native/i,
      /webkit\.messageHandlers/i,
      // React hydration mismatches (#418/#423) — caused by browser extensions
      // and in-app browsers (Facebook, Instagram) injecting DOM elements
      // before React hydrates. Not actionable.
      /Minified React error #418/,
      /Minified React error #423/,
    ]
    if (noisyPatterns.some((re) => re.test(msg))) return null
    return event
  },
});

// Hook into App Router navigation transitions — captures route change spans
// so Sentry shows navigation timing alongside pageload spans
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
