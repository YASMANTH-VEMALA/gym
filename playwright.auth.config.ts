import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e/auth',
  workers: 1,
  timeout: 45_000,
  outputDir: 'test-results/auth-browser',
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node apps/api/test/browser-fixture.cjs',
      url: 'http://127.0.0.1:3102',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'node ../../node_modules/next/dist/bin/next dev --port 3100',
      cwd: 'apps/web',
      url: 'http://127.0.0.1:3100/sign-in',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        WEB_ORIGIN: 'http://127.0.0.1:3100',
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:3102',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fixture-publishable',
        NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3101',
        NEXT_DIST_DIR: '.next-auth-test',
      },
    },
  ],
});
