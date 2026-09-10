import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/auth/**',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev:web',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm run dev:api',
      url: 'http://127.0.0.1:3001/health',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
