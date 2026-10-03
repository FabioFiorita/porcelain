import { availableParallelism } from 'node:os';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { hostCommands, serverProxy } from './spec/integration/host.ts';
import web from './vite.config.ts';

export default defineConfig({
  ...web,
  root: import.meta.dirname,
  server: { ...web.server, proxy: serverProxy },
  test: {
    name: 'integration',
    include: ['spec/integration/*.test.tsx'],
    globalSetup: ['spec/integration/host.ts'],
    allowOnly: false,
    passWithNoTests: false,
    maxWorkers: Math.max(
      1,
      Math.min(4, Math.floor(availableParallelism() / 4)),
    ),
    retry: 0,
    attachmentsDir: 'test-results/integration/attachments',
    expect: { requireAssertions: true },
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      screenshotDirectory: 'test-results/integration/screenshots',
      instances: [
        {
          browser: 'chromium',
          viewport: { width: 414, height: 896 },
        },
      ],
      commands: hostCommands,
    },
  },
});
