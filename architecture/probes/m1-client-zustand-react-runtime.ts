import type { Probe } from '../probe.ts';

export default {
  decision: 'M1',
  plants: 'shared vanilla state imports Zustand React bindings',
  gate: 'lint',
  rule: 'porcelain(client-platform-through-ports)',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/client/src/features/access/store.ts',
      content: "import 'zustand/react/shallow';\n",
    },
  ],
} satisfies Probe;
