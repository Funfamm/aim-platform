import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  productionBrowserSourceMaps: false,
  serverExternalPackages: [
    '@prisma/client',
    '.prisma/client',
    'better-sqlite3',
    'pino',
    'pino-pretty',
  ],
  webpack: (config, { isServer, dev }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'sharp$': false,
      'onnxruntime-node$': false,
    };
    // Keep these heavy server-only modules out of the client bundle
    if (!isServer) {
      config.resolve.alias['@prisma/client'] = false;
    }
    // Disable filesystem cache in dev to prevent .next/cache corruption
    // when Playwright's webServer and the manual dev server run concurrently.
    if (dev) {
      config.cache = false;
    }
    return config;
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: '**.cloudinary.com' },
      { protocol: 'https', hostname: '**.unsplash.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'localhost' }], // skip locally
        destination: 'https://%{host}/:path*',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Existing
          { key: 'Permissions-Policy', value: 'display-capture=()' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // New — transport security
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // New — Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://www.paypal.com https://www.paypalobjects.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https://*.amazonaws.com https://*.cloudinary.com https://*.unsplash.com https://lh3.googleusercontent.com https://*.r2.dev",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://accounts.google.com https://*.sentry.io https://*.r2.dev https://graph.microsoft.com https://www.paypal.com https://www.sandbox.paypal.com",
              "media-src 'self' blob: https://*.r2.dev",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self' https://accounts.google.com https://www.paypal.com",
              "frame-src 'self' https://www.paypal.com https://www.sandbox.paypal.com",
            ].join('; '),
          },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
      {
        source: '/uploads/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, private' },
          { key: 'Content-Disposition', value: 'inline' },
        ],
      },
    ]
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  // Suppress auth token warnings during build (no Sentry org set up yet)
  silent: true,
  disableLogger: true,
  telemetry: false,
  // Disable source map uploads — no SENTRY_AUTH_TOKEN in CI
  sourcemaps: {
    disable: true,
  },
});
