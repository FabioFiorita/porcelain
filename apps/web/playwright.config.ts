import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

process.env.TMPDIR = realpathSync(
  process.platform === 'darwin' ? '/tmp' : tmpdir(),
);

// Each viewport project gets its own playground server and repository.
process.env.PORCELAIN_PLAYGROUND_INFO ??= join(
  tmpdir(),
  `porcelain-web-${randomUUID()}.json`,
);
process.env.PORCELAIN_PLAYGROUND_INFO_NARROW ??= join(
  tmpdir(),
  `porcelain-web-${randomUUID()}.json`,
);

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  forbidOnly: true,
  retries: 0,
  // Specs within a project share its playground repository, and some write
  // files or move HEAD, so they run one at a time.
  workers: 1,
  // Playwright empties the output directory when it starts, so a second run in
  // this checkout deletes the artifacts of the one already going and fails it
  // with an ENOENT that looks nothing like its real cause. A run that expects
  // company gives itself somewhere else to write.
  ...(process.env.PORCELAIN_PLAYWRIGHT_OUTPUT
    ? { outputDir: process.env.PORCELAIN_PLAYWRIGHT_OUTPUT }
    : {}),
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/playground.spec.ts', '**/playground-auto.spec.ts'],
    },
    {
      name: 'narrow',
      use: { ...devices['Pixel 7'], baseURL: 'http://127.0.0.1:4176' },
      testIgnore: ['**/playground.spec.ts', '**/playground-auto.spec.ts'],
    },
    {
      name: 'development',
      testMatch: '**/playground.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4174' },
    },
    {
      name: 'automatic',
      testMatch: '**/playground-auto.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4175' },
    },
  ],
  webServer: [
    {
      command: 'cd ../.. && node scripts/web-playground.ts --preview',
      env: { PORCELAIN_PLAYGROUND_INFO: process.env.PORCELAIN_PLAYGROUND_INFO },
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
    },
    {
      command:
        'cd ../.. && node scripts/web-playground.ts --preview --port=4176',
      env: {
        PORCELAIN_PLAYGROUND_INFO: process.env.PORCELAIN_PLAYGROUND_INFO_NARROW,
      },
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
      url: 'http://127.0.0.1:4176',
      reuseExistingServer: false,
    },
    {
      command: 'cd ../.. && pnpm dev --manual --port=4174',
      env: {
        PORCELAIN_PLAYGROUND_INFO: '',
        PORCELAIN_PLAYGROUND_DIRECTORY: tmpdir(),
      },
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: false,
    },
    {
      command: 'cd ../.. && pnpm dev --port=4175',
      env: {
        PORCELAIN_PLAYGROUND_INFO: '',
        PORCELAIN_PLAYGROUND_DIRECTORY: tmpdir(),
      },
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
      url: 'http://127.0.0.1:4175',
      reuseExistingServer: false,
    },
  ],
});
