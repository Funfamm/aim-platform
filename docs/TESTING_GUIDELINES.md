# Testing Guidelines

> Comprehensive guide to running and writing tests for the AIM platform.

---

## Quick Reference

| Command | What It Does |
|---------|-------------|
| `npm test` | Run all unit + integration tests (Vitest) |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:coverage` | Run tests with coverage report (enforces thresholds) |
| `npm run test:e2e` | Run Playwright E2E tests (starts dev server automatically) |
| `npm run test:axe` | Run accessibility checks (WCAG 2.1 AA) |
| `npm run test:all` | Run **everything**: unit → integration → E2E → accessibility |

---

## Test Architecture

```
tests/
├── setup/
│   ├── vitest.setup.ts      # Global Vitest setup (env vars, console filters)
│   └── seed.ts               # Deterministic test data seed & cleanup
├── e2e/
│   ├── smoke.spec.ts         # All public pages load without errors
│   ├── auth.spec.ts          # Registration → login → dashboard → logout
│   └── accessibility.spec.ts # WCAG 2.1 AA scan on all public pages
├── performance/
│   ├── home_load.js          # k6 home page load test
│   └── api_endpoints.js      # k6 API latency test
src/
├── mocks/
│   ├── handlers.ts           # MSW handlers for all external APIs
│   └── server.ts             # MSW server for Vitest
├── lib/
│   ├── *.test.ts             # Unit tests (co-located with source)
│   └── agents/*.test.ts      # Agent tests
└── app/api/
    └── auth/register/
        └── register.integration.test.ts  # Integration test example
```

---

## Writing Tests

### Unit Tests (Vitest)
- **Location**: Co-locate with source file (e.g., `src/lib/cache.test.ts` next to `src/lib/cache.ts`)
- **Pattern**: `describe` → `it` → `expect`
- **External services**: Import MSW server for mocking:
  ```ts
  import { server } from '@/mocks/server'
  beforeAll(() => server.listen())
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())
  ```

### Integration Tests (Vitest + Prisma)
- **Location**: Co-locate with route (e.g., `route.integration.test.ts`)
- **Database**: Tests run against the dev database but use seeded data with fixed IDs
- **Pattern**: Import from `tests/setup/seed.ts`:
  ```ts
  import { seedTestData, cleanTestData, TEST_IDS } from '../../../tests/setup/seed'
  beforeAll(() => seedTestData())
  afterAll(() => cleanTestData())
  ```

### E2E Tests (Playwright)
- **Location**: `tests/e2e/*.spec.ts`
- **Config**: `playwright.config.ts` auto-starts the dev server
- **Browsers**: Chrome, Firefox, WebKit, Mobile Chrome, Mobile Safari

### Performance Tests (k6)
- **Location**: `tests/performance/*.js`
- **Run**: Requires k6 installed (`brew install k6` / `choco install k6`)
- **Thresholds**: Defined in each script and enforced in CI

---

## Coverage Requirements

| Metric | Threshold |
|--------|-----------|
| Statements | ≥ 85% |
| Branches   | ≥ 80% |
| Functions  | ≥ 80% |
| Lines      | ≥ 85% |

Coverage is enforced by Vitest and will fail the build if thresholds are not met.

---

## Mocking Strategy

All external APIs are mocked using **MSW (Mock Service Worker)** in `src/mocks/`:

| Service | Mocked Endpoint |
|---------|----------------|
| Microsoft Graph | `/v1.0/users/*/sendMail` |
| PayPal | `/v2/checkout/orders` + `/capture` |
| Google OAuth | `oauth2.googleapis.com/token` |
| Cloudflare R2 | `*.r2.cloudflarestorage.com/*` |
| Gemini AI | `generativelanguage.googleapis.com/*` |
| ElevenLabs | `api.elevenlabs.io/v1/*` |

**Rule**: Real API calls are **never** made in CI. Use the staging environment for manual verification with real credentials.

---

## CI Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs automatically on every push and PR to `main`:

1. **lint** — ESLint with zero-warning policy
2. **typecheck** — `tsc --noEmit`
3. **unit** — Vitest with coverage enforcement
4. **integration** — Vitest against a PostgreSQL container
5. **e2e** — Playwright on Chrome, Firefox, WebKit + mobile
6. **accessibility** — axe-core WCAG 2.1 AA scan
7. **security** — OWASP ZAP baseline scan
8. **performance** — k6 load tests with SLA thresholds

All 8 gates must pass before merging to `main`.

---

## Adding a New Test

1. For a **unit test**: Create `<filename>.test.ts` next to the source file
2. For an **integration test**: Create `<filename>.integration.test.ts` next to the API route
3. For an **E2E test**: Add to `tests/e2e/` with `.spec.ts` extension
4. For a **performance test**: Add to `tests/performance/` with `.js` extension
5. Link your test to a requirement ID in a comment: `// REQ-AUTH-01`
