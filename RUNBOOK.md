# RUNBOOK – AIM Platform Production Operations

## 1. Overview
This runbook documents the steps required to **deploy**, **monitor**, **troubleshoot**, and **rollback** the AIM Platform on Render (or any similar environment). It assumes the CI pipeline has already passed all checks.

---
### 1.1. Prerequisites
- **Render account** with the project linked to this repository.
- **Environment variables** configured in Render (see `.env.example`).
- **Redis** instance (Upstash) for BullMQ notification worker (optional but recommended).
- **Sentry** DSN for error tracking.
- **Prometheus** scraper configured to scrape `/api/metrics`.
- **Docker** installed locally for manual builds (optional).

---
## 2. Deployment Process
1. **Push to `main`** – CI will automatically run lint, tests, security audit, build, and push a Docker image.
2. **Render Deploy** – Render detects the new Docker tag and redeploys the service.
3. **Post‑deploy verification**:
   - Verify health endpoint: `GET https://<your‑domain>/api/health` returns `200`.
   - Check Sentry dashboard for any new errors.
   - Confirm Prometheus metrics are being scraped (`/api/metrics`).
   - Run a quick smoke test: `curl -s https://<your‑domain>/api/admin/settings` (requires admin token).

---
## 3. Monitoring & Observability
| Component | Endpoint / Tool | What to watch |
|-----------|----------------|--------------|
| **Health** | `/api/health` | 200 OK, response time < 200 ms |
| **Metrics** | `/api/metrics` (Prometheus) | request latency, error rates, DB connection pool usage |
| **Error tracking** | Sentry | New issues, spike in error volume |
| **OWASP ZAP** | CI job `security` | ZAP report artifact (`zap_report.html`) |
| **Performance** | k6 (`tests/performance`) | 95th‑pct latency < 800 ms, errors < 5 % |

---
## 4. Rollback Procedure
1. **Identify** the failing Docker tag in Render’s **Deployments** tab.
2. **Click “Rollback”** to the previous successful tag.
3. **Verify** health and metrics again.
4. If the issue is database‑related, you may need to restore a backup:
   - Render provides automated Postgres backups – restore via the Render UI.
   - After restore, run `npx prisma db push --force-reset --accept-data-loss` locally (if needed) and redeploy.

---
## 5. Database Migration Safety
- **Production migrations** must use `npm run db:deploy` (which runs `prisma migrate deploy`). This is safe because it never drops data.
- **CI / test databases** use `prisma db push --force-reset --accept-data-loss` (see CI workflow). No migration history is required.
- The **prisma‑guard** script (`scripts/prisma-guard.mjs`) blocks destructive commands on production URLs.

---
## 6. Common Issues & Fixes
| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| **P3005 – schema not empty** | CI job ran `prisma migrate deploy` on a fresh DB. | Ensure the e2e job only runs `prisma db push --force-reset`. The `build` script no longer calls migrate. |
| **Rate‑limit errors** | API requests exceed 100 req/min per IP. | Adjust `express-rate-limit` config in `src/middleware/security.ts` if needed. |
| **Missing metrics** | `/api/metrics` returns 404. | Verify `prom-client` is installed and the route file exists (`src/app/api/metrics/route.ts`). |
| **Swagger UI not loading** | `swagger-ui-express` expects an Express server. | Use the provided `/api/docs` route which serves the generated HTML. Ensure `public/openapi.json` exists. |
| **CI fails on lint** | New code violates ESLint rules. | Run `npm run lint:ci` locally and fix reported issues. |

---
## 7. Maintenance
- **Update dependencies**: `npm run release` will bump the version and generate a changelog.
- **Add new migrations**: Run `npx prisma migrate dev` locally, test, then push.
- **Add new API routes**: Remember to import the security middleware via `src/app/api/_middleware.ts` – it automatically applies to all API routes.

---
*End of Runbook*
