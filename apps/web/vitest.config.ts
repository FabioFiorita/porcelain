import { readdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { playwright } from '@vitest/browser-playwright';
import {
  defineConfig,
  type TestProjectInlineConfiguration,
} from 'vitest/config';
import { hostCommands, proxyFor } from './spec/integration/host.ts';
import web from './vite.config.ts';

const folder = 'spec/integration';
const tests = readdirSync(join(import.meta.dirname, folder))
  .filter((file) => file.endsWith('.test.tsx'))
  .sort();
const lanes = Math.max(
  1,
  Math.min(4, Math.floor(availableParallelism() / 4), tests.length),
);

function lane(index: number): TestProjectInlineConfiguration {
  const name = `lane-${index + 1}`;
  return {
    ...web,
    root: import.meta.dirname,
    server: { ...web.server, proxy: proxyFor(name) },
    test: {
      name,
      include: tests
        .filter((_, position) => position % lanes === index)
        .map((file) => `${folder}/${file}`),
      retry: 0,
      attachmentsDir: 'test-results/integration/attachments',
      fileParallelism: false,
      expect: { requireAssertions: true },
      browser: {
        enabled: true,
        provider: playwright(),
        headless: true,
        screenshotDirectory: 'test-results/integration/screenshots',
        instances: [
          {
            browser: 'chromium',
            name,
            viewport: { width: 414, height: 896 },
          },
        ],
        commands: hostCommands,
      },
    },
  };
}

export default defineConfig({
  test: {
    allowOnly: false,
    passWithNoTests: false,
    projects: Array.from({ length: lanes }, (_, index) => lane(index)),
  },
});
