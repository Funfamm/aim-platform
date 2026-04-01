# AIM Platform – Production‑Ready Deployment

## Overview
A modern **Next.js 15** AI‑driven filmmaking platform built with **TypeScript**, **Prisma**, **BullMQ**, and **Sentry**. The repository now includes a hardened CI/CD pipeline, zero‑cost security hardening, observability via Prometheus, and full release automation.

## Quick Start
```bash
# Install dependencies (including dev tools)
npm ci

# Set up environment variables (see .env.example)
cp .env.example .env.local
# Edit .env.local with your Render/Render‑Env values

# Run database migrations (development only)
npx prisma migrate dev

# Start the dev server
npm run dev
```

## CI Pipeline (GitHub Actions)
- **Lint** – `npm run lint:ci`
- **Security audit** – `npm audit --production --audit-level=high`
- **Unit / integration tests** – `npm run test:all`
- **E2E tests** – Playwright (`npm run test:e2e`)
- **Performance test** – k6 (`npm run test:performance`)
- **Deploy** – Render automatically runs on `main` push.

## Security Hardening
- **Helmet** and **express‑rate‑limit** applied to every API route via `src/app/api/_middleware.ts`.
- **Global security headers** added in `src/middleware.ts` (CSP, X‑Frame‑Options, etc.).
- **HTTPS redirect** enforced in `next.config.ts` for production.
- **Pre‑commit hook** (`.husky/pre‑commit`) aborts if Prisma schema drift is detected.
- **Zero‑cost** – all security measures run inside the Next.js server; no extra infra.

## Observability
- **Sentry** – already integrated for error tracking.
- **Prometheus metrics** – `/api/metrics` endpoint exposing `prom-client` metrics.
- **Swagger UI** – `/api/docs` serves interactive OpenAPI docs.
- **SEO** – `next-seo` defaults configured in `src/app/layout.tsx`.
- **Sitemap** – generated via `next-sitemap` (`npm run sitemap`).

## Release Automation
```bash
# Bump version, generate changelog, push tags
npm run release
```
The `standard-version` script creates a conventional changelog and pushes tags to `main`.

## Documentation
- **RUNBOOK.md** – detailed operational runbook (deployment, rollback, troubleshooting).
- **API docs** – Swagger UI at `/api/docs`.
- **Performance testing** – k6 config in `tests/performance/home_load.js` targets ~50 RPS with 95th‑pct < 800 ms.

## Contributing
1. Fork the repo.
2. Create a feature branch.
3. Ensure `npm run lint:ci && npm run test:all` passes.
4. Open a PR – CI will run all checks automatically.

---
*All enhancements are zero‑cost and use only open‑source packages.*
