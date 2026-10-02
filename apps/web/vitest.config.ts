import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { hostCommands, proxy } from './spec/integration/host.ts';
import web from './vite.config.ts';

export default defineConfig({
  ...web,
  server: { ...web.server, proxy },
  test: {
    include: ['spec/integration/*.test.tsx'],
    retry: 0,
    fileParallelism: false,
    allowOnly: false,
    passWithNoTests: false,
    expect: { requireAssertions: true },
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      screenshotDirectory: 'test-results/integration/screenshots',
      instances: [
        { browser: 'chromium', viewport: { width: 414, height: 896 } },
      ],
      commands: hostCommands,
    },
  },
});
