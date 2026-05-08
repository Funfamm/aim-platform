# Mobile Performance Optimization Sprint — May 2026

**Sprint period:** 2026-05-06 to 2026-05-07  
**Scope:** Homepage mobile Lighthouse performance (LCP, cold-start latency, CDN caching)  
**Status:** Closed — no further optimization planned.

---

## Post-Optimization Baseline

| Condition | Performance Score | LCP |
|---|---|---|
| **Warm** (function already running, CDN MISS but fast) | **83–87** | ~3.5–4.5s |
| **Cold** (function cold-start, Vercel spin-up) | **65–67** | ~6–8s |

These are the accepted baselines as of 2026-05-07. Warm performance is considered acceptable for the current phase. Cold-start variance is acknowledged but not prioritized further.

---

## Fixes Shipped

### Fix 1 — Hero Image: CSS background → Next.js `<Image>` component
**Commit:** `perf: migrate hero background to Next.js Image component`  
The hero background was rendered as a CSS `backgroundImage`, bypassing Next.js image optimization entirely. Replaced with `<NextImage fill priority>` which routes through `/_next/image`, delivers AVIF/WebP, adds `<link rel="preload">`, and sets immutable cache headers.  
- **Payload reduction:** ~950 KB PNG → ~11 KB AVIF (~98% reduction)  
- **LCP improvement:** Hero image is now the correct LCP element (`<img>` not a background div)

### Fix 2 — R2 Asset Cache Headers
**Commit:** `perf: apply immutable Cache-Control headers to all R2 uploads`  
All R2-hosted assets (uploads/, Trailers/, covers/, logos/) were served with no cache headers ("Cache TTL: None"). Applied `Cache-Control: public, max-age=31536000, immutable` to:
- All new uploads via `r2Upload.ts`, multipart, and stream routes
- All existing 442 objects via backfill script (`scratch/backfill-r2-cache-headers.mjs`)

### Fix 3A — Cookie Removal: CSRF token moved to lazy client fetch
**Commits:** `perf: remove cookie cache poisoning — edge-cache all public pages`  
The `csrf_token` cookie was set by middleware on every non-API page response. Any `Set-Cookie` header prevents Vercel's CDN from caching the response. Moved token issuance to:
- New `GET /api/csrf` endpoint — issues cookie only if not already present
- `AuthProvider.tsx` — fires `fetch('/api/csrf')` once on app mount alongside `/api/auth/me`, adding zero sequential latency

The login route still sets a fresh CSRF token on successful authentication. `verifyCsrfToken()` already allows requests through when the cookie is absent (pre-existing first-visit grace period).

### Fix 3B — Cookie Removal: NEXT_LOCALE cookie stripped from middleware
**Commits:** `perf: strip NEXT_LOCALE Set-Cookie`, `fix: reconstruct response without Set-Cookie`  
`next-intl` v4 writes a `NEXT_LOCALE` cookie on every page response unconditionally, regardless of `localeDetection: false`. This was a second independent cache-busting cookie. Fixed by reconstructing the middleware response from scratch (copying all headers except `set-cookie`) so the Edge runtime has no cookie store entry to serialize.

Language preference is now communicated via URL prefix (`/es/casting`) and client-side localStorage (`aim_locale_chosen`). The existing client-side language suggestion banner in `Navbar.tsx` (using `navigator.language`) is unaffected.

### Fix 4 — Removed `headers()` call from homepage
**Commits:** `perf: remove headers() from homepage — enables ISR edge caching`  
`page.tsx` called `await headers()` to read the User-Agent for server-side mobile detection (`isMobileServer`). In Next.js 15, calling `headers()` inside a Server Component opts the entire page into dynamic rendering, overriding `export const revalidate = 300`.

Removed:
- `import { headers } from 'next/headers'`
- `detectMobileUA()` function
- `isMobileHint` prop from `HomeHero` and `FeaturedProjects3D`

`FeaturedProjects3D` now starts with `isMobile = false` (desktop default) and `useIsMobile()` corrects after first client mount. At most one re-render on mobile — visually imperceptible.

### Fix 5 — `setRequestLocale()` added to layout and page
**Commit:** `fix: add setRequestLocale() to layout+page — enables ISR caching`  
`getTranslations()` and `getMessages()` from `next-intl/server` internally call `headers()` when no locale is provided statically. Added `setRequestLocale(locale)` at the top of both `layout.tsx` and `page.tsx` (before any next-intl server API calls) to resolve locale from URL params without reading request headers.  
Reference: https://next-intl.dev/docs/routing/setup#static-rendering

---

## Known Imperfections — Accepted

These are documented, understood, and intentionally left as-is.

| Issue | Impact | Decision |
|---|---|---|
| **ISR edge caching not active** | Cold starts produce 65–67 scores instead of consistent 85+. Some unidentified server component dependency still forces `Cache-Control: private`. | Accept. Warm performance is 83–87. Further investigation has diminishing returns. |
| **R2 poster card images are unoptimized PNGs** | Poster/movie card images bypass `/_next/image`. Not LCP-critical. | Accept for now. |
| **13 KiB unused CSS** | Minor payload | Accept |
| **12 KiB legacy JS polyfills** | Minor payload | Accept |
| **1,120ms render-blocking from Next.js CSS chunks** | Controllable only via framework internals | Accept |

---

## Monitoring Checklist (next 1–2 weeks)

Track the following in analytics — **do not make engineering changes based on intuition, only on data:**

- **Bounce rate** on mobile traffic from social referrals (TikTok, Instagram specifically)
- **Time-on-page** for mobile sessions
- **Click-through rate** from homepage → `/works` or individual film pages
- **Error reports** related to CSRF/cookie changes (form submissions, auth flows, notification preferences)

---

## Conditions for Revisiting Performance

Performance work should only be reopened if **field data** (not Lighthouse lab scores) shows one of:

1. High mobile bounce rate **persists** despite improvements — suggesting UX impact, not just lab score
2. CrUX / real-user monitoring shows >50% of mobile sessions experiencing cold-start LCP (>6s)
3. Business metrics (conversions, signups, watch-starts) are clearly capped by load time, not content

Lighthouse lab score variance (65 cold / 85 warm) alone is **not** sufficient justification to reopen this work.

---

## Architecture Notes for Future Reference

If ISR edge caching is ever revisited, the investigation should start with:
- Audit every Server Component in the `[locale]` layout tree for undeclared `cookies()`, `headers()`, or `noStore()` calls
- Check `SiteSettingsWrapper` and any context providers that may perform server-side data fetching
- Consider using Next.js `instrumentation` to log which dynamic APIs are called during render
- Check if `prisma.*` calls in Next.js 15 implicitly opt into dynamic rendering under any configuration

The middleware is clean. The cookies are clean. The remaining blocker is inside the render pipeline, not the request/response layer.
