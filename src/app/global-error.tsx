"use client";
// src/app/global-error.tsx
import React from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  // Capture the error in Sentry
  Sentry.captureException(error);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Something went wrong.</h2>
      <p>{isDev ? error.message : 'An unexpected error occurred. Please try again later.'}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
