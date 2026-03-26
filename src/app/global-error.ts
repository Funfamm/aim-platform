// src/app/global-error.ts
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  // Capture the error in Sentry
  Sentry.captureException(error);
  // Simple UI – you can customize
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Something went wrong.</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
