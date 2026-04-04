import { expect, test } from '@playwright/test';
import { attachStrictConsoleWatch, MAIN_NAV_LABELS } from './helpers/strictConsole';

test.describe('Konsolė be netikėtų klaidų (E2E build)', () => {
  test('pagrindinis kelias + visos skirtukų vietos — be console.error ir pageerror', async ({
    page,
  }) => {
    const failures: string[] = [];
    attachStrictConsoleWatch(page, failures);

    await page.goto('/');
    await expect(page.getByText('Švarus Darbas', { exact: false })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('navigation', { name: 'Pagrindinis meniu' })).toBeVisible({
      timeout: 10_000,
    });

    for (const label of MAIN_NAV_LABELS) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await page.waitForTimeout(650);
    }

    expect(failures, failures.join('\n---\n')).toEqual([]);
  });
});
