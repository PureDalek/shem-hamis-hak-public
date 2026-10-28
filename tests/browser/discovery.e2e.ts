import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('end of list repeats, preserves saved names, supports undo and reload', async ({page}) => {
  const search = {id: 'fixture', gender: 'boy', nameType: 'first', firstName: '', surname: '', inspirations: [], numbers: [], categories: ['fixture'], decisions: {}, history: [], customNames: [], createdAt: Date.now()};
  const settings = JSON.parse(readFileSync(new URL('../../src/data/settings.json', import.meta.url), 'utf8'));
  const state = {version: 1, activeId: search.id, searches: [search], family: [], overrides: {}, settings: {...settings, sort: 'alphabetical'}, extraCatalog:
    ['אבא', 'ברק'].map((name, i) => ({id: `fixture:${i}`, name, genders: ['boy'], observations: [], tags: ['fixture']}))};
  await page.goto('/');
  await page.evaluate(state => localStorage.setItem('shem-hamis-hak-v1', JSON.stringify(state)), state);
  await page.reload();
  const card = page.locator('.display-name');
  await expect(card).toHaveText('אבא');
  await page.getByRole('button', {name: 'אהבתי!'}).click();
  await expect(card).toHaveText('ברק');
  await page.getByRole('button', {name: 'פחות בשבילי'}).click();
  await expect(card).toHaveText('אבא');
  await expect(page.locator('.count-line')).toContainText('סבב 2');
  await page.getByRole('button', {name: 'חזרה לשם הקודם'}).click();
  await expect(card).toHaveText('ברק');
  await page.getByRole('button', {name: 'פחות בשבילי'}).click();
  await page.getByRole('button', {name: 'אהבתי!'}).click();
  await expect(card).toHaveText('ברק');
  await page.reload();
  await expect(card).toHaveText('ברק');
  await expect(page.locator('.count-line')).toContainText('סבב 2');
  await page.getByRole('button', {name: /1 שמורים/}).click();
  await expect(page.locator('.list-item')).toContainText('אבא');
});

test('extra categories can be selected and retained when editing on phone and desktop', async ({page}, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'בת', exact: true}).click();
  await page.getByRole('button', {name: 'עוד נושאים'}).click();
  await page.getByRole('button', {name: 'אור ושמיים', exact: true}).click();
  await expect(page.getByRole('button', {name: 'אור ושמיים', exact: true})).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const bounds = await page.getByRole('button', {name: 'אור ושמיים', exact: true}).boundingBox();
  expect(bounds?.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({path: testInfo.outputPath('category-picker.png'), fullPage: true});
  await page.getByRole('button', {name: 'יאללה, מתחילים'}).click();
  await expect(page.locator('.category-labels').getByText('אור ושמיים', {exact: true})).toBeVisible();
  await page.reload();
  await expect(page.locator('.category-labels').getByText('אור ושמיים', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'שינוי חיפוש'}).click();
  await expect(page.getByRole('button', {name: 'אור ושמיים', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', {name: 'פחות נושאים'})).toHaveAttribute('aria-expanded', 'true');
});
