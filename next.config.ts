import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // NOTE: 'standalone' output removed — it is for Docker/Render only.
  // Vercel handles bundling natively; standalone mode causes >250MB function sizes.
  productionBrowserSourceMaps: false,

  serverExternalPackages: [
    // Prisma — needs native binaries, must stay external
    '@prisma/client',
    '.prisma/client',
    // Heavy ML/WASM libraries — client-only, must NOT be bundled into server functions
    '@huggingface/transformers',
    '@ffmpeg/ffmpeg',
    '@ffmpeg/util',
    // Redis / queue — server-only but very large
    'bullmq',
    'ioredis',
    // Misc server packages
    'better-sqlite3',
    'pino',
    'pino-pretty',
    '@google/generative-ai',
    'bcrypt',
    'nodemailer',
  ],

  // outputFileTracingExcludes: Tells Vercel's file tracer to PHYSICALLY exclude
  // these packages from the deployment bundle. serverExternalPackages alone is
  // not enough — Vercel still traces and includes the files. This is the real fix
  // for the 250MB serverless function size limit.
  outputFileTracingExcludes: {
    '*': [
      // #1 OFFENDER: ONNX Runtime native binaries (404 MB in build log!)
      'node_modules/onnxruntime-node/**',
      'node_modules/onnxruntime-web/**',
      // ML framework — references onnxruntime, must be excluded too (~3MB JS)
      'node_modules/@huggingface/transformers/**',
      // Sharp native image processing binaries (32 MB in build log)
      'node_modules/@img/**',
      'node_modules/sharp/**',
      // FFmpeg WASM binaries
      'node_modules/@ffmpeg/ffmpeg/**',
      'node_modules/@ffmpeg/util/**',
      'node_modules/@ffmpeg/core/**',
      // Playwright (E2E tests only, not needed at runtime)
      'node_modules/@playwright/**',
      'node_modules/playwright/**',
      'node_modules/playwright-core/**',
      // Dev/test tools
      'node_modules/vitest/**',
      'node_modules/@vitest/**',
      // Prisma: strip wrong-OS binary engines (keep only rhel-openssl for Vercel)
      'node_modules/.prisma/client/libquery_engine-darwin*',
      'node_modules/.prisma/client/libquery_engine-windows*',
      'node_modules/.prisma/client/query_engine-windows*',
      'node_modules/@prisma/engines/libquery_engine-darwin*',
      'node_modules/@prisma/engines/libquery_engine-windows*',
      'node_modules/@prisma/engines/query_engine-windows*',
    ],
  },

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
    return [];
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
              "img-src 'self' data: blob: https://*.amazonaws.com https://*.cloudinary.com https://*.unsplash.com https://lh3.googleusercontent.com https://*.r2.dev https://*.r2.cloudflarestorage.com",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://accounts.google.com https://*.sentry.io https://*.r2.dev https://*.r2.cloudflarestorage.com https://graph.microsoft.com https://www.paypal.com https://www.sandbox.paypal.com",
              "media-src 'self' blob: https://*.r2.dev https://*.r2.cloudflarestorage.com",
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
