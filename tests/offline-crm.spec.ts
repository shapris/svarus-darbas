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

  test('greitas darbuotojo priskyrimas užsakymui lieka po perkrovimo (offline)', async ({
    page,
  }) => {
    test.setTimeout(60_000);
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

    await page.waitForFunction(
      () => {
        const su = localStorage.getItem('saved_user');
        const cu = localStorage.getItem('svaraus_darbas_current_user');
        const raw = su || cu;
        if (!raw) return false;
        const uid = JSON.parse(raw).uid as string;
        return !!uid && !!localStorage.getItem(`profile_${uid}`);
      },
      undefined,
      { timeout: 15_000 }
    );
    await page.evaluate(() => {
      const su = localStorage.getItem('saved_user');
      const cu = localStorage.getItem('svaraus_darbas_current_user');
      const raw = su || cu;
      if (!raw) throw new Error('no user in localStorage');
      const uid = JSON.parse(raw).uid as string;
      const pr = localStorage.getItem(`profile_${uid}`);
      if (!pr) throw new Error('no profile');
      const p = JSON.parse(pr) as { role?: string };
      p.role = 'admin';
      localStorage.setItem(`profile_${uid}`, JSON.stringify(p));
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Švarus Darbas' })).toBeVisible({
      timeout: 20_000,
    });

    const stamp = Date.now();
    const empName = `E2E darb. ${stamp}`;
    const clientName = `E2E klientas prisk. ${stamp}`;

    await page.getByRole('button', { name: 'Komanda' }).click();
    await expect(page.getByRole('heading', { name: 'Komanda' })).toBeVisible();
    await page.getByRole('button', { name: 'Pridėti darbuotoją' }).click();
    await page.getByPlaceholder('Vardenis Pavardenis').fill(empName);
    await page.getByPlaceholder('+370 600 00000').fill('+37060000999');
    await page.getByRole('button', { name: 'Išsaugoti' }).click();
    await expect(page.getByRole('heading', { name: empName, exact: false })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole('button', { name: /Užsakymai/i }).click();
    await expect(page.getByRole('heading', { name: 'Užsakymai' })).toBeVisible();
    await page.getByRole('button', { name: 'Naujas užsakymas' }).click();
    await expect(page.getByRole('heading', { name: 'Naujas užsakymas' })).toBeVisible();
    await page.getByRole('button', { name: 'Naujas klientas' }).click();
    await page.getByPlaceholder('Pvz. Jonas Jonaitis').fill(clientName);
    await page.getByPlaceholder('+370...').fill('+37060000000');
    await page.getByPlaceholder('Gatvė, miestas').fill(`Test g. ${stamp}, Vilnius`);
    await page.getByRole('button', { name: 'Sukurti užsakymą' }).click();
    await expect(page.getByText(clientName, { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    });

    const assignSelect = page.getByRole('combobox', {
      name: new RegExp(
        `Greitas darbuotojo priskyrimas užsakymui\\s+${clientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        'i'
      ),
    });
    await expect(assignSelect).toBeVisible({ timeout: 10_000 });
    await assignSelect.selectOption({ label: empName });
    await expect(assignSelect).not.toHaveValue('');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Švarus Darbas' })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /Užsakymai/i }).click();
    await expect(page.getByRole('heading', { name: 'Užsakymai' })).toBeVisible();
    const assignAfterReload = page.getByRole('combobox', {
      name: new RegExp(
        `Greitas darbuotojo priskyrimas užsakymui\\s+${clientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        'i'
      ),
    });
    await expect(assignAfterReload).toBeVisible({ timeout: 10_000 });
    await expect(assignAfterReload).not.toHaveValue('');
  });
});
