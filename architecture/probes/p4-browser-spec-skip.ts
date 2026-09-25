import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a browser case is skipped',
  gate: 'web-lint',
  rule: 'porcelain(web-browser-spec-no-skips)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/spec/browser/probe.browser.ts',
      content:
        "import { test } from 'vitest';\n\ntest.skip('probe', () => undefined);\n",
    },
  ],
} satisfies Probe;
