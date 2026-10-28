import { expect, test } from '@playwright/test';

test('search, undo, shortlist and tournament survive a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'שם אמצעי' }).click();
  await page.getByPlaceholder('כדי לראות איך השמות נשמעים ביחד').fill('נועה');
  await page.getByRole('button', { name: 'יאללה, מתחילים' }).click();

  const name = page.locator('.display-name');
  const firstName = await name.innerText();
  await expect(page.locator('.fullname')).toContainText(`נועה ${firstName}`);
  await page.getByRole('button', { name: 'אהבתי!' }).click();
  await expect(name).not.toHaveText(firstName);
  await page.getByRole('button', { name: 'חזרה לשם הקודם' }).click();
  await expect(name).toHaveText(firstName);
  await page.getByRole('button', { name: 'אהבתי!' }).click();
  await page.getByRole('button', { name: 'אהבתי!' }).click();
  await page.getByRole('button', { name: 'אהבתי!' }).click();

  await page.reload();
  await page.getByRole('button', { name: /3 שמורים/ }).click();
  await expect(page.locator('.list-item')).toHaveCount(3);
  await page.getByRole('button', { name: /מוכנים לטורניר/ }).click();
  await expect(page.locator('.tournament-picks button[aria-pressed="true"]')).toHaveCount(3);
  await page.getByRole('button', { name: 'מתחילים טורניר' }).click();
  await expect(page.locator('.match-cards button')).toHaveCount(2);
  await page.reload();
  await page.getByRole('button', { name: 'טורניר', exact: true }).click();
  for (let match = 0; match < 2; match++) {
    await page.locator('.match-cards button').first().click();
  }
  await expect(page.locator('.winner-card')).toBeVisible();
  await page.getByRole('button', { name: /3 שמורים/ }).click();
  await expect(page.locator('.list-item')).toHaveCount(3);
});
