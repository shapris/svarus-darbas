import { expect, test } from '@playwright/test';

/**
 * Simuliuoja darbuotoją: pagrindinis meniu, skiltys, atsijungimas, kliento portalas.
 * `npm run build:e2e` (.env.e2e → VITE_ALLOW_OFFLINE_CRM) — vietinis CRM, automatinis kūrimo prisijungimas.
 */
test.describe('Naudotojo kelias (CRM)', () => {
  test('eina per pagrindines skiltis ir atsijungia', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Švarus Darbas' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('navigation', { name: 'Pagrindinis meniu' })).toBeVisible();

    await page.getByRole('button', { name: /Užsakymai/i }).click();
    await expect(page.getByRole('heading', { name: 'Užsakymai' })).toBeVisible();

    await page.getByRole('button', { name: /Klientai/i }).click();
    await expect(page.getByRole('heading', { name: 'Klientai' })).toBeVisible();

    await page.getByRole('button', { name: /Išlaidos/i }).click();
    await expect(page.getByRole('heading', { name: /Išlaidos/i })).toBeVisible();

    await page.getByRole('button', { name: /Mokėjimai/i }).click();
    await expect(
      page.getByText(/Sąskaitų|Sąskaitos|Transakcijų|Transakcijos|Kraunami mokėjimai/i).first()
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /Nustatymai/i }).click();
    await expect(page.getByRole('heading', { name: /Nustatymai/i })).toBeVisible();

    await page.getByRole('button', { name: /Kalendorius/i }).click();
    await expect(page.getByRole('heading', { name: /Kalendorius/i })).toBeVisible();

    await page.getByRole('button', { name: /Apžvalga/i }).click();
    await expect(page.getByRole('heading', { name: /Apžvalga/i })).toBeVisible();

    await page.getByRole('button', { name: /Daugiau/i }).click();
    await expect(page.getByRole('heading', { name: 'Daugiau' })).toBeVisible();
    await page
      .getByRole('button', { name: /Analitika/i })
      .first()
      .click();
    await expect(page.getByRole('heading', { name: 'Analitika' })).toBeVisible();

    await page.getByRole('button', { name: 'Atsijungti' }).click();
    await expect(page.getByRole('button', { name: /Darbuotojo prisijungimas/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Kliento prisijungimas/i })).toBeVisible();
  });

  test('kliento portalo prisijungimo ekranas', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Švarus Darbas' })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('button', { name: 'Atsijungti' }).click();
    await page.getByRole('button', { name: /Kliento prisijungimas/i }).click();

    await expect(page.getByRole('heading', { name: /Kliento prisijungimas/i })).toBeVisible();
    await page.getByRole('button', { name: /Atgal/i }).first().click();
    await expect(page.getByRole('button', { name: /Darbuotojo prisijungimas/i })).toBeVisible();
  });
});
