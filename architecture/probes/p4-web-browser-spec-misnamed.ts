import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a browser case without the .browser.ts suffix',
  gate: 'arch',
  rule: 'unclassified-source:',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/spec/browser/probe.spec.ts',
      content:
        "import { test } from 'vitest';\n\ntest('probe', () => undefined);\n",
    },
  ],
} satisfies Probe;
