import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'the Playwright config retries a failed e2e test twice, so a flaky flow could pass',
  gate: 'web-lint',
  rule: 'style(playwright-config)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/web/playwright.config.ts',
      old: '  retries: 0,\n',
      new: '  retries: 2,\n',
    },
  ],
} satisfies Probe;
