import { expect, test } from '@playwright/test';

test('a backup restores saved names after device data is cleared', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'יאללה, מתחילים' }).click();
  const name = await page.locator('.display-name').innerText();
  await page.getByRole('button', { name: 'אהבתי!' }).click();
  await page.getByRole('button', { name: 'פרופיל', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /גיבוי הנתונים/ }).click();
  const download = await downloadPromise;
  const path = await download.path();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'מחיקת כל הנתונים במכשיר' }).click();
  await page.getByRole('button', { name: 'יאללה, מתחילים' }).click();
  await page.getByRole('button', { name: 'פרופיל', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('input[type=file][accept="application/json,.json"]').setInputFiles(path);
  await expect(page.getByText('הגיבוי שוחזר')).toBeVisible();
  await page.getByRole('button', { name: /1 שמורים/ }).click();
  await expect(page.locator('.list-item')).toContainText(name);
});

test('numerology dialog supports keyboard dismissal and returns focus', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'יאללה, מתחילים' }).click();
  const trigger = page.getByRole('button', { name: /מספר נומרולוגי/ });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'סגירה' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
