import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.ts/,
  /** Debesies smoke — tik `playwright.cloud.config.ts` + `npm run test:cloud` */
  testIgnore: ['**/cloud-smoke.spec.ts'],
  timeout: 30_000,
  fullyParallel: false,
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build:e2e && npm run preview',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      CI: 'true',
      VITE_OPEN_BROWSER: 'false',
      VITE_SILENT_EXPECTED_PROXY_ERRORS: 'true',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
