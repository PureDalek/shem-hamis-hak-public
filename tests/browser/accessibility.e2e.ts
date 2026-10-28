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
  await checkAccessibility(page);
  await page.getByRole('button', { name: 'יאללה, מתחילים' }).click();
  await checkAccessibility(page);
  await page.getByRole('button', { name: 'אהבתי!' }).click();
  await page.getByRole('button', { name: 'אהבתי!' }).click();
  await page.getByRole('button', { name: /2 שמורים/ }).click();
  await checkAccessibility(page);
  await page.getByRole('button', { name: /מוכנים לטורניר/ }).click();
  await checkAccessibility(page);
});
