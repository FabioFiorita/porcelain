import { defineConfig } from '@playwright/test';
import type { Shell } from './spec/e2e/fixtures.ts';

const desktopJourneys = '**/*.desktop.e2e.ts';

export default defineConfig<{ shell: Shell }>({
  testDir: './spec/e2e',
  testMatch: '**/*.e2e.ts',
  globalSetup: './spec/e2e/global-setup.ts',
  outputDir: './test-results/e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: process.env.CI ? 2 : 1,
  timeout: 60_000,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: './test-results/e2e-report' }],
  ],
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 414, height: 896 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'web', testIgnore: desktopJourneys, use: { shell: 'web' } },
    { name: 'desktop', testMatch: desktopJourneys, use: { shell: 'desktop' } },
  ],
});
