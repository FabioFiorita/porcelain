import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

process.env.PORCELAIN_PLAYGROUND_INFO ??= join(
  tmpdir(),
  `porcelain-web-${randomUUID()}.json`,
);

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  forbidOnly: true,
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'narrow', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command:
      'pnpm build && cd ../.. && node scripts/web-playground.ts --preview',
    env: { PORCELAIN_PLAYGROUND_INFO: process.env.PORCELAIN_PLAYGROUND_INFO },
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
