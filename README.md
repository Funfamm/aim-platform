# Impact AI Studio Platform

A full-stack AI media and project submission platform built to support film publishing, client project requests, admin workflows, multilingual user experiences, email notifications, uploads, and production deployment.

This project demonstrates hands-on experience with modern web development, application support, technical troubleshooting, deployment workflows, and product-focused problem solving.

## Project Overview

Impact AI Studio Platform is designed as a professional media and AI service platform where users can explore creative projects, submit custom project requests, receive updates, and interact with a polished web experience.

The platform includes public-facing pages, admin workflow planning, project submission flows, multilingual user experience improvements, email notification logic, upload workflows, and deployment hardening.

## My Role

I worked across product planning, frontend structure, admin workflow design, troubleshooting, deployment support, and technical documentation. My work focused on turning real business needs into usable platform features while improving reliability, usability, and production readiness.

Key areas I worked on include:

- Planning and refining user-facing project submission workflows
- Improving admin-side workflow structure and feature logic
- Supporting multilingual UX and translation-related platform behavior
- Troubleshooting deployment, DNS, hosting, upload, and browser issues
- Documenting technical changes, system behavior, and implementation plans
- Testing platform behavior across desktop and mobile experiences

## Tech Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend / Data:** Prisma, SQL/database workflows
- **Deployment:** Vercel, Render, GitHub
- **Cloud / Assets:** Cloudflare-based asset and upload workflows
- **Quality / Monitoring:** GitHub Actions, testing workflows, observability planning
- **Development Focus:** Responsive design, application support, deployment troubleshooting, admin workflows, and technical documentation

## Key Features

- Public media and project pages
- Client project submission workflow
- Admin workflow and project management planning
- Email notification and status update logic
- Multilingual user experience support
- Upload and asset management workflows
- Mobile-responsive interface improvements
- Deployment and production troubleshooting
- Documentation for implementation, QA, and platform hardening

## Why This Project Matters

This project connects software development with real-world business needs. It shows my ability to work with modern web technologies while also thinking about user experience, reliability, support workflows, and production deployment.

It is especially relevant to roles such as:

- Application Developer
- Web Developer
- IT Support Analyst
- Application Support Analyst
- QA Tester
- Technical Support Specialist
- Junior Software Developer


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
