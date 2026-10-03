import type { Probe } from '../probe.ts';

export default {
  decision: 'M2',
  plants: 'two Android native capabilities import each other',
  gate: 'arch',
  rule: 'no-circular-source-imports:',
  edits: [
    {
      kind: 'create',
      path: 'apps/mobile/src/shared/probe-cycle-a.android.ts',
      content: "import './probe-cycle-b.android.ts';\n",
    },
    {
      kind: 'create',
      path: 'apps/mobile/src/shared/probe-cycle-b.android.ts',
      content: "import './probe-cycle-a.android.ts';\n",
    },
  ],
} satisfies Probe;
