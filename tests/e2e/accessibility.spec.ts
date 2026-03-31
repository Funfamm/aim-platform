/**
 * E2E — Accessibility (axe-core)
 *
 * Scans every public page for WCAG 2.1 AA violations.
 * Fails if any violation with "critical" or "serious" impact is found.
 */
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const PUBLIC_ROUTES = [
    '/',
    '/about',
    '/works',
    '/casting',
    '/contact',
    '/donate',
    '/login',
    '/register',
    '/forgot-password',
    '/offline',
]

for (const route of PUBLIC_ROUTES) {
    test(`Accessibility: ${route}`, async ({ page }) => {
        // Use networkidle for pages with video/fetch to avoid "execution context destroyed"
        const waitState = (route === '/casting' || route === '/works')
            ? 'networkidle'
            : 'domcontentloaded'

        await page.goto(route, { waitUntil: waitState })

        // Extra settle time for client-rendered pages
        if (route === '/casting' || route === '/works') {
            await page.waitForTimeout(1000)
        }

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            // CSS gradient text (WebkitTextFillColor: transparent) makes axe
            // unable to compute the real foreground color — produces false positives
            .disableRules(['color-contrast'])
            .analyze()

        // Only fail on critical and serious violations (excluding color-contrast
        // which is separately validated by our CSS design token values)
        const critical = results.violations.filter(
            v => v.impact === 'critical' || v.impact === 'serious'
        )

        if (critical.length > 0) {
            const summary = critical
                .map(v => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`)
                .join('\n')
            expect(critical.length, `Accessibility violations on ${route}:\n${summary}`).toBe(0)
        }
    })
}
