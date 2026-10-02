import type { Probe } from '../probe.ts';

export default {
  decision: 'S5',
  plants:
    'the desktop Playwright config retries a failed e2e test, so a flaky native flow passes on its second try',
  gate: 'lint',
  rule: 'style(playwright-config)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/desktop/playwright.config.ts',
      old: '  retries: 0,\n',
      new: '  retries: 2,\n',
    },
  ],
} satisfies Probe;
