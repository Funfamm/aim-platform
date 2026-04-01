import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E Configuration
 *
 * Projects: Desktop Chrome, Firefox, WebKit + Mobile Chrome & Safari
 * Trace & video captured on first-retry for debugging.
 */
export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 2 : undefined,
    reporter: process.env.CI
        ? [['html', { open: 'never' }], ['github']]
        : [['html', { open: 'on-failure' }]],

    timeout: 60_000,

    use: {
        baseURL: process.env.BASE_URL || 'http://localhost:3000',
        trace: 'on-first-retry',
        video: 'retain-on-failure',
        screenshot: 'only-on-failure',
        actionTimeout: 15_000,
    },

    projects: [
        // ── Desktop ─────────────────────────────────────────────────
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },

        // ── Mobile ──────────────────────────────────────────────────
        {
            name: 'mobile-chrome',
            use: { ...devices['Pixel 5'] },
        },
        {
            name: 'mobile-safari',
            use: { ...devices['iPhone 12'] },
        },
    ],

    /* 
     * No webServer block — start `npm run dev` manually before running tests.
     * In CI, the workflow starts the server and waits for it before running Playwright.
     */
})
