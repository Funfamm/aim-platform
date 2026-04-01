// tests/e2e/full-audit.spec.ts
import { test, expect, Page } from '@playwright/test';
import { faker } from '@faker-js/faker';
import prisma from '../../src/lib/prisma'; // adjust path if needed

// Helper to collect all clickable elements on a page
async function collectClickableSelectors(page: Page): Promise<string[]> {
  const selectors = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('a[href], button, [role="button"]'));
    return elements.map((el, i) => {
      const tag = el.tagName.toLowerCase();
      const text = (el.textContent || '').trim().substring(0, 30);
      const id = el.id ? `#${el.id}` : '';
      const cls = el.className ? `.${el.className.split(' ')[0]}` : '';
      return `${tag}${id}${cls}: "${text}"`;
    });
  });
  return selectors;
}

// Generic test that visits each route and clicks each element
async function testPage(page: Page, path: string) {
  await page.goto(`http://localhost:3000${path}`);
  await expect(page).toHaveURL(new RegExp(`^http://localhost:3000${path}`));
  const selectors = await collectClickableSelectors(page);
  for (const sel of selectors) {
    try {
      const [type, rest] = sel.split(':');
      const [tag, identifier] = type.split(/[#.]/);
      const selector = `${tag}${identifier ? identifier.startsWith('#') ? identifier : `.${identifier}` : ''}`;
      const element = await page.$(selector);
      if (!element) continue;
      // If it's a form input, fill with faker data (simple heuristic)
      if (tag === 'input' && (await element.getAttribute('type')) !== 'submit') {
        const name = await element.getAttribute('name');
        if (name) {
          const fake = faker.lorem.words(2);
          await element.fill(fake);
        }
      }
      await element.click({ force: true });
      // Wait for navigation or network idle
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    } catch (e) {
      console.warn('Click failed for selector', sel, e);
    }
  }
}

// List of routes to test – we can discover dynamically, but for simplicity we list main ones
const routes = [
  '/',
  '/login',
  '/admin',
  '/admin/dashboard',
  '/admin/settings',
  '/profile',
  '/settings',
  '/about',
  '/contact',
];

for (const route of routes) {
  test(`Audit page ${route}`, async ({ page }) => {
    await testPage(page, route);
  });
}

// Auth flow tests
test('User login flow', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD || 'Password123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  await expect(page).toHaveURL(/dashboard/);
});

test('Admin login flow', async ({ page }) => {
  await page.goto('http://localhost:3000/admin/login');
  await page.fill('input[name="email"]', process.env.TEST_ADMIN_EMAIL || 'admin@example.com');
  await page.fill('input[name="password"]', process.env.TEST_ADMIN_PASSWORD || 'AdminPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin/dashboard');
  await expect(page).toHaveURL(/admin\/dashboard/);
});
