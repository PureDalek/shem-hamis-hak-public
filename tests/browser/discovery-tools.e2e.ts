import { expect, test } from '@playwright/test';

test('length and first-letter filters persist and can be removed during discovery', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'טבע', exact: true }).click();
  await page.getByLabel(/אורך השם/).selectOption('short');
  await page.getByLabel(/אות ראשונה/).selectOption('א');
  await page.getByRole('button', { name: 'יאללה, מתחילים' }).click();
  await expect(page.locator('.display-name')).toHaveText(/^א.{0,2}$/);
  await expect(page.getByRole('button', { name: 'הסרת סינון אורך' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'הסרת סינון אות א' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'הסרת סינון טבע' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.display-name')).toHaveText(/^א.{0,2}$/);
  await page.getByRole('button', { name: 'הסרת סינון אות א' }).click();
  await expect(page.getByRole('button', { name: 'הסרת סינון אות א' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'הסרת סינון אורך' })).toBeVisible();
  await page.getByRole('button', { name: 'שינוי חיפוש' }).click();
  await expect(page.getByLabel(/אורך השם/)).toHaveValue('short');
  await expect(page.getByLabel(/אות ראשונה/)).toHaveValue('');
});

test('shortlist search, sorting, duplicate notice and similar names work together', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'יאללה, מתחילים' }).click();
  await page.getByRole('button', { name: /0 שמורים/ }).click();
  for (const name of ['דוד', 'אור', 'אביב']) {
    await page.getByPlaceholder('הוספת שם משלכם').fill(name);
    await page.getByRole('button', { name: 'הוספת שם', exact: true }).click();
  }
  await expect(page.locator('.list-item')).toHaveCount(3);
  await page.getByPlaceholder('הוספת שם משלכם').fill('אוֹר');
  await page.getByRole('button', { name: 'הוספת שם', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'השם כבר נמצא ברשימה שלכם' })).toBeVisible();
  await expect(page.locator('.list-item')).toHaveCount(3);
  await page.getByLabel('מיון הרשימה').selectOption('alphabetical');
  await expect(page.locator('.list-name strong')).toHaveText(['אביב', 'אור', 'דוד']);
  await page.getByLabel('חיפוש ברשימה').fill('אוֹר');
  await expect(page.locator('.list-name strong')).toHaveText(['אור']);
  await page.getByLabel('חיפוש ברשימה').fill('לאקיים');
  await expect(page.getByText('לא מצאנו שם מתאים ברשימה')).toBeVisible();
  await page.getByRole('button', { name: 'ניקוי החיפוש' }).click();
  await page.getByPlaceholder('הוספת שם משלכם').fill('שם בדיקה ייחודי');
  await page.getByRole('button', { name: 'הוספת שם', exact: true }).click();
  await page.getByLabel('מיון הרשימה').selectOption('reported');
  await expect(page.getByText(/לפי נתוני 2020–2024 שפורסמו בלבד/)).toBeVisible();
  await expect(page.locator('.list-name strong').last()).toHaveText('שם בדיקה ייחודי');
  await expect(page.locator('.list-name').last()).toContainText('אין נתונים שפורסמו');
  await page.getByTitle('פירוט על השם אור').click();
  await page.getByRole('button', { name: /עוד שמות בסגנון הזה/ }).click();
  const panel = page.locator('.similar-panel');
  await expect(panel.getByRole('heading', { name: 'עוד שמות בסגנון אור' })).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'עוד שמות בסגנון אור' })).toBeFocused();
  await expect(panel.locator('.similar-result').first()).toBeVisible();
  await expect(panel.locator('.similar-name small').first()).not.toBeEmpty();
  await expect(panel.getByRole('button', { name: 'שמירת אור', exact: true })).toHaveCount(0);
  await panel.getByLabel('אותיות משותפות').check();
  await expect(panel.getByText('אותיות משותפות אינן מבטיחות צליל דומה.')).toBeVisible();
  const suggestion = await panel.locator('.similar-name strong').first().innerText();
  await panel.getByRole('button', { name: `שמירת ${suggestion}`, exact: true }).click();
  await expect(page.getByRole('button', { name: /5 שמורים/ })).toBeVisible();
  await expect(panel.getByRole('button', { name: `שמירת ${suggestion}`, exact: true })).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: /5 שמורים/ }).click();
  await expect(page.getByTitle(`פירוט על השם ${suggestion}`)).toBeVisible();
});
