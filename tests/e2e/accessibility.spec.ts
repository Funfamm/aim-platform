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
        await page.goto(route, { waitUntil: 'domcontentloaded' })

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze()

        // Only fail on critical and serious violations
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
