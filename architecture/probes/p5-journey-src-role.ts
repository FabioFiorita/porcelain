import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants: 'an integration test imports a feature view from src',
  gate: 'arch',
  rule: 'integration-spec-cannot-import-view:',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/spec/integration/probe.test.tsx',
      content:
        "import { NotPaired } from '../../src/features/access/views/not-paired';\n\nexport const probeView = NotPaired;\n",
    },
  ],
} satisfies Probe;
