/**
 * E2E Smoke Test — Public Pages
 *
 * Verifies every public page loads with a 200 status,
 * has no console errors, and renders key elements.
 */
import { test, expect, type Page } from '@playwright/test'

// Set a generous navigation timeout to accommodate DB warm‑up.
test.beforeEach(async ({ page }) => {
  page.setDefaultNavigationTimeout(15000);
});


// Helper: collect console errors during navigation
async function navigateAndCheck(page: Page, path: string, expectedTitle?: RegExp) {
    const errors: string[] = []
    page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text())
    })

    const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBeLessThan(400)

    if (expectedTitle) {
        await expect(page).toHaveTitle(expectedTitle)
    }

    // Filter out expected benign errors (e.g. missing env vars in test)
    const realErrors = errors.filter(e =>
        !e.includes('NEXT_REDIRECT') &&
        !e.includes('favicon') &&
        !e.includes('hydration')
    )

    expect(realErrors.length, `Console errors on ${path}: ${realErrors.join(', ')}`).toBe(0)
}

test.describe('Public Pages Smoke Test', () => {
    test('Home page loads', async ({ page }) => {
        await navigateAndCheck(page, '/', /AIM/i)
        // Hero section should be visible
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
    test('GET /api/health returns 200', async ({ request }) => {
        const res = await request.get('/api/health')
        expect(res.status()).toBe(200)
    })

    test('GET /api/site-settings returns 200', async ({ request }) => {
        const res = await request.get('/api/site-settings')
        expect(res.status()).toBe(200)
    })
})

test.describe('404 Page', () => {
    test('Non-existent route returns 404 page', async ({ page }) => {
        const response = await page.goto('/this-page-does-not-exist', { waitUntil: 'domcontentloaded' })
        expect(response?.status()).toBe(404)
    })
})
