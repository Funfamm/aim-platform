This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Render

This app is deployed on [Render](https://render.com). To deploy:

1. Push your code to GitHub
2. Create a new **Web Service** on [dashboard.render.com](https://dashboard.render.com)
3. Connect your GitHub repo and configure:
   - **Build Command:** `npm install && npx prisma generate && npm run build`
   - **Start Command:** `npm start`
4. Add all environment variables (DATABASE_URL, JWT_SECRET, etc.) in the Render **Environment** tab
5. Deploy

For production database migrations, Render runs `prisma migrate deploy` automatically via the build command. See [DEPLOYMENT.md](DEPLOYMENT.md) for full details.

---

## 🛡️ Database Safety

This project includes a **production database guard** that prevents accidental data loss when running Prisma commands locally.

### The Problem

Running `prisma migrate dev` or `prisma db push` against a production database can **drop columns and destroy data**. If your `.env` file contains a production `DATABASE_URL`, a single command can wipe user data.

### The Solution

1. **`.env` uses a dev database only** — Production credentials live exclusively in Render's environment variables, never in local files.
2. **`scripts/prisma-guard.mjs`** — A guard script that inspects `DATABASE_URL` before every destructive Prisma command. If it detects a production host (e.g., `.neon.tech`, `.supabase.co`, `.render.com`), it **blocks the command** with a clear error.
3. **Safe npm scripts** — All database commands go through the guard:

| Script | Command | Safe for Production? |
|--------|---------|---------------------|
| `npm run db:migrate` | `prisma migrate dev` | 🛑 Blocked on production |
| `npm run db:push` | `prisma db push` | 🛑 Blocked on production |
| `npm run db:reset` | `prisma migrate reset` | 🛑 Blocked on production |
| `npm run db:seed` | Seed superadmin | 🛑 Blocked on production |
| `npm run db:deploy` | `prisma migrate deploy` | ✅ Safe (applies pending migrations) |
| `npm run db:studio` | `prisma studio` | ✅ Safe (read-only browser) |
| `npm run db:status` | `prisma migrate status` | ✅ Safe (status check only) |

### Setting Up a Dev Database

**Option A: Neon Dev Branch (Recommended)**
1. Go to [console.neon.tech](https://console.neon.tech) → your project → **Branches** → **Create Branch**
2. Copy the branch connection string
3. Paste it into `.env` as `DATABASE_URL` and `DIRECT_URL`
4. Run `npm run db:migrate` to apply schema

**Option B: Local PostgreSQL**
1. Install PostgreSQL locally or use Docker: `docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres`
2. Set `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aim_dev"` in `.env`
3. Run `npm run db:migrate`

### Rules

- **Never** put production database URLs in `.env` — use Render's dashboard instead
- **Always** use `npm run db:*` scripts instead of raw `prisma` commands
- For production migrations, use `npm run db:deploy` (safe, non-destructive)

---

## 🎨 Theme & Appearance

AIM Studio uses a **CSS custom-property (token) design system** that fully supports dark and light themes and user-selectable accent colours.

### How Themes Work

The default theme is **dark** (cinematic, deep navy / charcoal). A **light** (warm cream) theme is activated by setting `data-theme="light"` on `<html>`.

Users can choose between **Dark**, **Light**, or **System** in their dashboard (`/dashboard` → _Appearance_ card). The preference is stored in `localStorage` under the key `aim-theme`. The system mode mirrors the OS preference in real time.

#### Token Override Strategy

All theme-specific values live in `src/app/globals.css`:

```css
/* Default dark theme tokens */
:root { --bg-primary: #0a0b0f; ... }

/* Light theme overrides — warm cream palette */
[data-theme='light'] { --bg-primary: #faf9f6; ... }
```

> **Rule:** Always use a CSS custom property (e.g., `var(--bg-card)`) in component styles. Never use hard-coded hex colours in `.tsx` or `.css` files.

### Glass Morphism Opacity

The glass card opacity is exposed as a design token so it can be customised per theme or per component:

```css
:root { --glass-opacity: 0.65; }

[data-theme='light'] .glass-card {
  background: rgba(255, 255, 255, var(--glass-opacity));
}
```

To adjust the effect globally, override `--glass-opacity` in the appropriate theme block.

### Accent Colours

Five curated accent palettes are available (Gold · Silver · Ember · Jade · Azure). Users select swatches in the dashboard; the choice is stored under `aim-accent` in `localStorage`.

#### Adding a New Accent

1. Open `src/components/dashboard/ProfileTab.tsx`.
2. Append a new entry to the `ACCENTS` array:

```ts
{
    key: 'violet',
    label: 'Violet',
    base: '#8b5cf6',
    light: '#a78bfa',
    dark: '#6d28d9',
    glow: 'rgba(139,92,246,0.15)',
    glowStrong: 'rgba(139,92,246,0.25)',
    lift: '0 8px 30px rgba(139,92,246,0.25), 0 2px 8px rgba(139,92,246,0.15)',
},
```

The `applyAccent()` helper and picker UI pick it up automatically — no other changes needed.

### Semantic Colour Tokens

For status indicators, alerts, and feedback UI, use the semantic tokens defined in `:root` — **never** a raw hex:

| Token | Usage | Value |
|-------|-------|-------|
| `--color-error` | Errors, required fields | `#ef4444` |
| `--color-success` | Success states | `#34d399` |
| `--color-info` | Informational | `#60a5fa` |
| `--color-warning` | Warnings | `#f59e0b` |
| `--color-muted` | Disabled / secondary | `#6b7280` |

### Accessibility

- Theme and accent controls use `role="radiogroup"` / `role="radio"` with `aria-checked`.
- Accent swatches have `aria-label` and `title` attributes readable by screen readers.
- Keyboard focus on accent swatches is styled via `.accent-swatch:focus-visible` in `globals.css`.

### Contributor Checklist

Before opening a PR that touches UI:

- [ ] All new colours use `var(--token-name)` — no raw hex in `.tsx`/`.css`.
- [ ] New components tested in both dark and light themes.
- [ ] `npx tsc --noEmit` returns zero errors.

---

## Security

### Authentication & Sessions
- **Short-lived JWTs** — access tokens expire in 15 minutes; refresh tokens in 7 days.
- **Token rotation** — refresh endpoint issues new token pairs; old tokens are effectively revoked.
- **Token version revocation** — incrementing `tokenVersion` on a user record invalidates all existing tokens.
- **Secure cookies** — all auth cookies use `HttpOnly`, `Secure` (in production), and `SameSite: lax`.

### Rate Limiting
- **Login/Register** — `authLimiter`: 10 requests/min per IP.
- **File uploads** — `uploadLimiter`: 5 requests/min per IP.
- **AI endpoints** — `aiLimiter`: 3 requests/min per IP (audit, batch-audit).
- **General API** — `apiLimiter`: 60 requests/min per IP (notifications).
- **Application email limit** — max 5 applications per email per 24 hours (DB-enforced).

### File Upload Validation
- **Photo uploads** — MIME whitelist (`image/jpeg`, `image/png`, `image/webp`), max 5 MB per file.
- **Voice uploads** — MIME whitelist (`audio/mpeg`, `audio/mp4`, `audio/wav`, `audio/webm`, `audio/ogg`), max 25 MB.
- **Admin uploads** — extension whitelist + MIME cross-validation, category-specific size caps.

### CSRF Protection
- **Double-submit cookie** pattern on all admin mutation endpoints (`POST/PUT/PATCH/DELETE` to `/api/admin/*`).
- Middleware verifies `X-CSRF-Token` header matches the `csrf_token` cookie.
- Admin panel automatically injects CSRF tokens via the `CsrfProvider` component.

### Security Headers
| Header | Value |
|--------|-------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Content-Security-Policy` | Restricts script/style/img/font/connect/media sources |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `display-capture=()` |

### Error Handling
- Production error pages show generic messages; full details only in development.
- All API routes use `sanitizeError()` to prevent stack trace leakage.
- Sentry captures all errors server-side for monitoring.

### Audit Logging
- Destructive admin actions (bulk-delete, role changes, settings updates) are logged via `logAdminAction()`.
- Audit entries include: actor (userId), action type, target resource, and timestamp.
- Logs are written to the structured logger and console (visible in Render logs).

### Password Policy
- Minimum 8 characters with at least 1 uppercase, 1 lowercase, and 1 digit.
- Enforced on registration and admin credential management.

### Dependency Security
- **GitHub Dependabot** monitors npm dependencies weekly.
- **CI/CD** runs `npm audit --audit-level=high` on every push/PR.

### Reporting Vulnerabilities
If you discover a security vulnerability, please email the project maintainer directly. Do not open a public issue.
