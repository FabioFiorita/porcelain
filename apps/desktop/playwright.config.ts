import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './spec/e2e',
  testMatch: '**/*.e2e.ts',
  outputDir: './test-results/e2e',
  globalSetup: './spec/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: './test-results/e2e-report' }],
  ],
});
