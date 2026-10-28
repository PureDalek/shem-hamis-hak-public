import { expect, test } from '@playwright/test';

test('a disputed meaning shows source count, qualifications and distinct links on saved names', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'יאללה, מתחילים' }).click();
  await page.evaluate(() => {
    const key = 'shem-hamis-hak-v1';
    const state = JSON.parse(localStorage.getItem(key)!);
    state.searches.find((s: { id: string }) => s.id === state.activeId).decisions['cbs:אסתי'] = 'like';
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await page.getByRole('button', { name: /1 שמורים/ }).click();
  await page.getByTitle('פירוט על השם אסתי', { exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'אסתי', exact: true });
  await expect(dialog.getByText('פירוש שנוי במחלוקת:', { exact: true })).toBeVisible();
  await expect(dialog.getByText('3 סימוכין', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/המשמעות כוכב תלויה בהצעה/)).toBeVisible();
  const evidence = dialog.locator('.meaning-evidence');
  await expect(evidence.locator('ul').getByRole('link')).toHaveCount(3);
  await expect(evidence.getByRole('link', { name: /American Heritage/ })).toHaveAttribute('href', 'https://www.ahdictionary.com/word/search.html?q=Esther');
  await expect(evidence.getByText(/אינה ציון ודאות/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('meaning-evidence.png') });
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});
