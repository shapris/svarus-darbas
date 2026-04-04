import { expect, test } from '@playwright/test';

test('landing page renders core CRM actions', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Švarus Darbas', { exact: false })).toBeVisible();
  await expect(
    page
      .getByRole('button', { name: /Atsijungti/i })
      .or(page.getByRole('button', { name: /Kliento prisijungimas/i }))
  ).toBeVisible();
  await expect(
    page
      .getByRole('button', { name: /Mokėjimai/i })
      .or(page.getByRole('button', { name: /Prisijungti su Google/i }))
  ).toBeVisible();
});
