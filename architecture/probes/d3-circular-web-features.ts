import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'two new web feature rules import each other',
  gate: 'arch',
  rule: 'no-circular-source-imports:',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/files/rules/probe-cycle-a.ts',
      content:
        "import { probeB } from './probe-cycle-b';\n\nexport const probeA = (): number => probeB();\n",
    },
    {
      kind: 'create',
      path: 'apps/web/src/features/files/rules/probe-cycle-b.ts',
      content:
        "import { probeA } from './probe-cycle-a';\n\nexport const probeB = (): number => (probeA ? 0 : 1);\n",
    },
  ],
} satisfies Probe;
