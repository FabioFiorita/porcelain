import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import web from '../../../../apps/web/vite.config.ts';
import { journeyCommands } from './journey-commands.ts';

const webRoot = resolve(import.meta.dirname, '../../../../apps/web');
const evidence =
  process.env.PORCELAIN_WEB_EVIDENCE ??
  join(tmpdir(), 'porcelain-web-browser-attachments');

export default defineConfig({
  ...web,
  root: webRoot,
  server: {
    ...web.server,
    fs: { allow: [webRoot, evidence] },
  },
  test: {
    include: ['spec/browser/*.browser.ts', 'spec/negative/*.browser.ts'],
    retry: 0,
    attachmentsDir: evidence,
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [
        { browser: 'chromium', viewport: { width: 414, height: 896 } },
      ],
      screenshotDirectory: join(evidence, 'screenshots'),
      commands: journeyCommands,
    },
  },
});
