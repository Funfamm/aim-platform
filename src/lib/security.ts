/**
 * Security helper — CSP & response headers
 *
 * Centralises the Content-Security-Policy string and all security
 * headers so middleware and next.config.ts stay in sync.
 *
 * CSP is intentionally aligned with the policy in next.config.ts.
 * Edit here; next.config.ts acts as the static fallback for Vercel/CDN
 * layers that bypass Next.js middleware.
 *
 * Reference: OWASP Secure Headers Project
 */

export const CSP_HEADER = 'content-security-policy'

/**
 * Returns the canonical CSP directive string.
 * Matches the policy in next.config.ts — keep both in sync.
 */
export function buildCsp(): string {
  const directives: string[] = [
    "default-src 'self'",
    // unsafe-eval required by some Next.js/React internals in prod hydration
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com https://www.paypal.com https://www.paypalobjects.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // R2 / S3 / Cloudinary / Google avatars + Sentry CDN resources
    "img-src 'self' data: blob: https://*.amazonaws.com https://*.cloudinary.com https://*.unsplash.com https://lh3.googleusercontent.com https://*.r2.dev https://*.cloudflare.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    // API calls: Sentry, Google OAuth, PayPal, R2 storage, Microsoft Graph
    "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://*.sentry.io https://*.r2.dev https://graph.microsoft.com https://www.paypal.com https://www.sandbox.paypal.com https://api.paypal.com",
    "media-src 'self' blob: https://*.r2.dev https://*.amazonaws.com",
    "frame-src 'self' https://accounts.google.com https://www.paypal.com https://www.sandbox.paypal.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com https://www.paypal.com",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ]
  return directives.join('; ')
}

/**
 * Full set of security response headers applied in middleware.
 * next.config.ts has these as a static fallback for edge/CDN layers.
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    // HSTS — 2-year max-age, include subdomains, preload list eligible
    'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',

    // Prevent MIME-type sniffing
    'x-content-type-options': 'nosniff',

    // Anti-clickjacking (legacy; CSP frame-ancestors is the modern equivalent)
    'x-frame-options': 'SAMEORIGIN',

    // Disable legacy XSS auditor (browsers ignore it; CSP is the correct mechanism)
    'x-xss-protection': '0',

    // Limit referrer information in cross-origin requests
    'referrer-policy': 'strict-origin-when-cross-origin',

    // Restrict browser APIs
    'permissions-policy':
      'geolocation=(), microphone=(), camera=(), payment=(self "https://www.paypal.com"), usb=()',

    // Content-Security-Policy
    [CSP_HEADER]: buildCsp(),
  }
}
