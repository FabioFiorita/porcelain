import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a browser case mocks with vi instead of the real isolated server',
  gate: 'web-lint',
  rule: 'porcelain(web-browser-spec-no-mocks)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/spec/browser/probe.browser.ts',
      content: "import { vi } from 'vitest';\n\nvi.fn();\n",
    },
  ],
} satisfies Probe;
