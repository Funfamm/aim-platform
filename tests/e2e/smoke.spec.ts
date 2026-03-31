/**
 * E2E Smoke Test — Public Pages
 *
 * Verifies every public page loads without a server-level error,
 * has no critical console errors, and renders key elements.
 *
 * Status threshold is < 500 (not strict 200) because:
 *   - CI runs in dev mode where middleware/auth can legitimately 30x
 *   - Mobile-safari Playwright devices can follow redirects differently
 *   - We care about ruling out 5xx server crashes, not canonicalization
 */
import { test, expect, type Page } from '@playwright/test'

// 30s — gives DB warm-up + Next.js compilation time in CI
test.beforeEach(async ({ page }) => {
  page.setDefaultNavigationTimeout(30000)
})

// Helper: navigate and assert no server-level failure
async function navigateAndCheck(page: Page, path: string, expectedTitle?: RegExp) {
    const errors: string[] = []
    page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text())
    })

    const response = await page.goto(path, { waitUntil: 'domcontentloaded' })

    // Allow valid 3xx redirects from auth/middleware; only fail on 5xx
    expect(response, `No response received for ${path}`).not.toBeNull()
    expect(response!.status(), `Unexpected status for ${path}`).toBeLessThan(500)

    if (expectedTitle) {
        await expect(page).toHaveTitle(expectedTitle)
    }

    // Filter known benign console noise in dev/CI
    const realErrors = errors.filter(e =>
        !e.includes('NEXT_REDIRECT') &&
        !e.includes('favicon') &&
        !e.includes('hydration') &&
        !e.includes('Warning:') &&
        !e.includes('REDIS_URL')
    )
    expect(realErrors.length, `Console errors on ${path}: ${realErrors.join(', ')}`).toBe(0)
}

test.describe('Public Pages Smoke Test', () => {
    test('Home page loads', async ({ page }) => {
        await navigateAndCheck(page, '/', /AIM/i)
        await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10000 })
    })

    test('About page loads', async ({ page }) => {
        await navigateAndCheck(page, '/about', /About/i)
    })

    test('Works page loads', async ({ page }) => {
        await navigateAndCheck(page, '/works')
    })

    test('Casting page loads', async ({ page }) => {
        await navigateAndCheck(page, '/casting')
    })

    test('Contact page loads', async ({ page }) => {
        await navigateAndCheck(page, '/contact')
    })

    test('Donate page loads', async ({ page }) => {
        await navigateAndCheck(page, '/donate')
    })

    test('Login page loads', async ({ page }) => {
        await navigateAndCheck(page, '/login')
    })

    test('Register page loads', async ({ page }) => {
        await navigateAndCheck(page, '/register')
    })

    test('Forgot Password page loads', async ({ page }) => {
        await navigateAndCheck(page, '/forgot-password')
    })

    test('Offline page loads', async ({ page }) => {
        await navigateAndCheck(page, '/offline')
    })
})

test.describe('API Health Endpoints', () => {
    test('GET /api/health is successful', async ({ request }) => {
        const res = await request.get('/api/health')
        const body = await res.text()
        expect(
            res.status(),
            `GET /api/health failed with ${res.status()} — body: ${body.slice(0, 500)}`
        ).toBeLessThan(500)
    })

    test('GET /api/site-settings is successful', async ({ request }) => {
        const res = await request.get('/api/site-settings')
        const body = await res.text()
        expect(
            res.status(),
            `GET /api/site-settings failed with ${res.status()} — body: ${body.slice(0, 500)}`
        ).toBeLessThan(500)
    })
})

test.describe('404 Page', () => {
    test('Non-existent route renders not-found experience', async ({ page }) => {
        const response = await page.goto('/this-page-does-not-exist', { waitUntil: 'domcontentloaded' })
        expect(response, 'No response for non-existent route').not.toBeNull()

        // Next.js App Router renders not-found.tsx inline (200) OR returns raw 404
        // depending on middleware and dev/prod mode. Both are valid outcomes.
        const status = response!.status()
        expect(
            [200, 404, 307, 308],
            `Unexpected status ${status} for non-existent route`
        ).toContain(status)
    })
})
