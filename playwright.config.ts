import { defineConfig, devices } from '@playwright/test';

const localBaseUrl = 'http://127.0.0.1:4173/eft-season-optimizer/';
const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? localBaseUrl;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: '.tmp/playwright-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never', outputFolder: '.tmp/playwright-report' }]]
    : 'list',
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_TEST_BASE_URL
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 4173',
        url: `${localBaseUrl}wireframe.html`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
