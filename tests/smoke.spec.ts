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

test('client portal routes resolve to login flow', async ({ page }) => {
  await page.goto('/client/login');
  await expect(page).toHaveURL(/\/(client\/login)?$/);
  await expect(
    page
      .getByRole('heading', { name: 'Kliento prisijungimas' })
      .or(page.getByRole('navigation', { name: 'Pagrindinis meniu' }))
  ).toBeVisible({
    timeout: 15_000,
  });

  await page.goto('/client/dashboard');
  await expect(page).toHaveURL(/\/(client\/login)?$/);
  await expect(
    page
      .getByRole('heading', { name: 'Kliento prisijungimas' })
      .or(page.getByRole('navigation', { name: 'Pagrindinis meniu' }))
  ).toBeVisible({
    timeout: 15_000,
  });

  await page.goto('/client/register');
  await expect(page).toHaveURL(/\/(client\/register)?$/);
  await expect(
    page
      .getByRole('heading', { name: /Kliento registracija|Kliento saviregistracija išjungta/i })
      .or(page.getByText(/saviregistracija išjungta/i))
      .or(page.getByRole('navigation', { name: 'Pagrindinis meniu' }))
  ).toBeVisible({ timeout: 15_000 });
});
