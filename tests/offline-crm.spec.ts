import { expect, test } from '@playwright/test';

/**
 * Vietinis CRM (`.env.e2e` → `VITE_ALLOW_OFFLINE_CRM`): prisijungimas forma ir užsakymo juosta.
 */
test.describe('Offline CRM (E2E build)', () => {
  test('prisijungimas po atsijungimo — demo@example.com', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Švarus Darbas' })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('button', { name: 'Atsijungti' }).click();
    await expect(page.getByRole('button', { name: /Darbuotojo prisijungimas/i })).toBeVisible();

    await page.getByRole('button', { name: /Darbuotojo prisijungimas/i }).click();
    await page.getByPlaceholder('El. paštas').fill('demo@example.com');
    await page.getByPlaceholder('Slaptažodis').fill('demo123');
    await page.getByRole('button', { name: 'Prisijungti' }).click();

    await expect(page.getByRole('navigation', { name: 'Pagrindinis meniu' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('naujas užsakymas su nauju klientu rodomas sąraše', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Švarus Darbas' })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('button', { name: /Užsakymai/i }).click();
    await expect(page.getByRole('heading', { name: 'Užsakymai' })).toBeVisible();

    await page.getByRole('button', { name: 'Naujas užsakymas' }).click();
    await expect(page.getByRole('heading', { name: 'Naujas užsakymas' })).toBeVisible();

    await page.getByRole('button', { name: 'Naujas klientas' }).click();

    const stamp = Date.now();
    const clientName = `E2E klientas ${stamp}`;
    await page.getByPlaceholder('Pvz. Jonas Jonaitis').fill(clientName);
    await page.getByPlaceholder('+370...').fill('+37060000000');
    await page.getByPlaceholder('Gatvė, miestas').fill(`Test g. ${stamp}, Vilnius`);

    await page.getByRole('button', { name: 'Sukurti užsakymą' }).click();

    await expect(page.getByText(clientName, { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
