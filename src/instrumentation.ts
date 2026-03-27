/** Required environment variables — validated once at server start */
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SENTRY_DSN',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
]

export async function register() {
  // ── Env‑var validation ─────────────────────────────────────────────────────
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key])
  if (missing.length > 0) {
    console.warn(
      `[AIM] ⚠️  Missing environment variables:\n${missing.map((k) => `  • ${k}`).join('\n')}\n` +
      `  These may cause runtime failures — please set them before deploying.`
    )
  }

  // ── Sentry ─────────────────────────────────────────────────────────────────
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}
