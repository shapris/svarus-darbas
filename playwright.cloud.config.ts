/**
 * Atskiras Playwright konfigas debesies smoke testams (tikras Supabase klientas naršyklėje).
 * Paleidimas: npm run test:cloud (reikia .env.cloud-e2e.local su VITE_SUPABASE_*).
 *
 * Pagrindinis `playwright.config.ts` ir `npm run verify` šio failo NEvykdo.
 */
import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests',
  testMatch: /cloud-smoke\.spec\.ts/,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build:cloud-e2e && npm run preview',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      CI: 'true',
      VITE_OPEN_BROWSER: 'false',
      VITE_SILENT_EXPECTED_PROXY_ERRORS: 'true',
    },
  },
  projects: [
    {
      name: 'chromium-cloud',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
