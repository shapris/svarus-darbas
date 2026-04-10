import { expect, test } from '@playwright/test';
import { attachStrictConsoleWatch } from './helpers/strictConsole';

/**
 * Debesies smoke (@cloud): build su --mode cloud-e2e + tikri VITE_SUPABASE_*.
 * Neįtraukta į `npm run verify` — paleiskite: npm run test:cloud
 */
test.describe('Cloud debesis @cloud', { tag: '@cloud' }, () => {
  test('programėlė kraunasi su sukonfigūruotu Supabase (ne „Reikalinga duomenų bazė“)', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.getByText('Švarus Darbas', { exact: false }).first()).toBeVisible({
      timeout: 25_000,
    });

    const setupWall = page.getByRole('heading', { name: 'Reikalinga duomenų bazė' });
    await expect(setupWall).toHaveCount(0);

    // Be sesijos debesyje — landing + „Darbuotojo prisijungimas“; su sesija — CRM apačios meniu
    const inCrm = page.getByRole('navigation', { name: 'Pagrindinis meniu' });
    const staffLogin = page.getByRole('button', { name: /Darbuotojo prisijungimas/i });
    await expect(inCrm.or(staffLogin).first()).toBeVisible({ timeout: 15_000 });
  });

  test('pagrindinis meniu — Užsakymai be netikėtų konsolės klaidų', async ({ page }) => {
    const failures: string[] = [];
    attachStrictConsoleWatch(page, failures);

    await page.goto('/');

    const nav = page.getByRole('navigation', { name: 'Pagrindinis meniu' });
    if (await nav.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Užsakymai', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Užsakymai' })).toBeVisible({
        timeout: 15_000,
      });
    } else {
      await page.getByRole('button', { name: /Darbuotojo prisijungimas/i }).click();
      await expect(page.getByPlaceholder('El. paštas')).toBeVisible({ timeout: 15_000 });
    }

    expect(failures, failures.join('\n')).toEqual([]);
  });
});
