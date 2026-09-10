import { defineConfig, devices } from '@playwright/test';

const development = process.env.PORCELAIN_SITE_SMOKE_MODE === 'development';
const port = development ? 4311 : 4310;
export default defineConfig({
  testDir: './e2e',
  forbidOnly: true,
  retries: 0,
  workers: 1,
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
  ],
  webServer: {
    command: development
      ? `pnpm dev --port ${port}`
      : `pnpm build && pnpm start --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    env: { PORCELAIN_SITE_URL: 'https://porcelain.example' },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
