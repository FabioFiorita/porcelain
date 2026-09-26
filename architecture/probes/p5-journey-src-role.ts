import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants: 'a journey imports a feature view from src',
  gate: 'arch',
  rule: 'browser-spec-cannot-import-view:',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/spec/browser/probe.browser.ts',
      content:
        "import { NotPaired } from '../../src/features/access/views/not-paired';\n\nexport const probeView = NotPaired;\n",
    },
  ],
} satisfies Probe;
