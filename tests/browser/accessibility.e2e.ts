import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function checkAccessibility(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([]);
}

test('core screens pass automated accessibility checks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'עוד נושאים' }).click();
  await checkAccessibility(page);
  await page.getByRole('button', { name: 'יאללה, מתחילים' }).click();
  await checkAccessibility(page);
  await page.getByRole('button', { name: 'אהבתי!' }).click();
  await page.getByRole('button', { name: 'אהבתי!' }).click();
  await page.getByRole('button', { name: /2 שמורים/ }).click();
  await checkAccessibility(page);
  await page.getByTitle(/פירוט על השם/).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await checkAccessibility(page);
  await page.getByRole('button', { name: /עוד שמות בסגנון הזה/ }).click();
  await expect(page.locator('.similar-panel')).toBeVisible();
  await checkAccessibility(page);
  await page.getByRole('button', { name: 'סגירת המלצות' }).click();
  await page.getByRole('button', { name: /מוכנים לטורניר/ }).click();
  await checkAccessibility(page);
  await page.getByRole('button', { name: 'פרופיל', exact: true }).click();
  await checkAccessibility(page);
  await page.getByRole('button', { name: /הגדרות ועריכת מאגר מקומית/ }).click();
  await checkAccessibility(page);
});
