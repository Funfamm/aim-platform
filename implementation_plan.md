# Implementation Plan for Render + Cloudflare Production Hardening

## Goal
Add missing security, reliability, and monitoring features to the **aim‑platform** site that is deployed on Render and fronted by Cloudflare. This includes:
- Enforcing HTTPS with HSTS
- Adding a strict Content‑Security‑Policy (CSP) and other security headers
- Providing a health‑check endpoint for uptime monitoring
- Adding optional Cloudflare page‑rule configuration
- Updating CI to verify the headers after deployment

## User Review Required
> [!IMPORTANT]
> Do you use any third‑party scripts or services (e.g., Google Analytics, Hotjar, Intercom, Stripe, etc.) that need to be whitelisted in the CSP? Please list the domains so the policy can be generated correctly.

## Proposed Changes
---
### 1. Security Headers Middleware
- **File:** `src/middleware.ts` *(new file)* – a Next.js Edge middleware that adds the following headers to **all** responses:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - `Content-Security-Policy: <generated‑csp>`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Frame-Options: SAMEORIGIN`
  - `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- **File:** `next.config.ts` – ensure the `middleware` entry points to `src/middleware.ts` and that the `headers` function returns the same static headers for any non‑middleware routes (fallback).

### 2. Health‑Check Endpoint
- **File:** `src/app/api/health/route.ts` *(new file)* – returns a JSON payload `{ "status": "ok", "timestamp": "<ISO>" }` with a 200 status. This endpoint will be used by Render health checks and Cloudflare monitors.

### 3. CSP Configuration
- The CSP string will be built in `src/lib/security.ts` (new helper) so it can be easily edited. A **default‑strict** policy will be:
  ```
  default-src 'self';
  script-src 'self' https://www.googletagmanager.com https://www.google-analytics.com;   # add more if needed
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https://*.cloudflare.com;
  connect-src 'self' https://api.render.com https://*.cloudflare.com;
  frame-src 'self';
  object-src 'none';
  base-uri 'self';
  ```
- Adjust the `script-src` and `connect-src` entries based on the answer to the **User Review Required** question.

### 4. Optional Cloudflare Configuration
- **File:** `cloudflare.json` *(new file)* – describes page‑rules for:
  - HTTP → HTTPS redirect (if not already enforced by Render)
  - Caching static assets (`/static/*`, `/public/*`) with a long `max‑age`
  - Security level "High" for the whole domain
- This file can be imported into Cloudflare via the API or UI.

### 5. CI Verification Step
- Update `.github/workflows/ci.yml`:
  1. After the `Deploy` job (Render deployment), add a step that runs:
     ```bash
     curl -I https://<YOUR_RENDER_URL> | grep -E "strict-transport-security|content-security-policy|x-content-type-options|referrer-policy|x-frame-options"
     ```
  2. Fail the workflow if any of the required headers are missing.
- Add a small Node script `scripts/verify-headers.js` to parse the curl output and exit with non‑zero status on failure.

---
## Open Questions
> [!WARNING]
> - **CSP whitelist:** List any external domains (analytics, fonts, payment providers, etc.) that must be allowed.
> - **Subdomains for HSTS preload:** Do you have any subdomains (e.g., `api.impactaistudio.com`) that should be included in the preload list?

## Verification Plan
### Automated Tests
- Run `npm run dev` locally and execute `curl -I http://localhost:3000` to confirm all security headers are present.
- In CI, after deployment, run the header‑verification script against the live Render URL.
- Add unit tests for `src/lib/security.ts` to ensure the CSP string contains required directives.

### Manual Verification
- Open the live site (`https://impactaistudio.com`) in a browser, open DevTools → Network → Headers, and verify the presence and values of the security headers.
- Use an online CSP validator (e.g., https://csp-evaluator.withgoogle.com) to check syntax.
- Check Cloudflare dashboard to ensure the page‑rules from `cloudflare.json` are applied.

---
*Once you confirm the CSP whitelist and any subdomain considerations, I will proceed to create the files and update the CI workflow.*
