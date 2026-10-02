import type { Probe } from '../probe.ts';

export default {
  decision: 'M1',
  plants: 'shared client state imports an app React runtime',
  gate: 'lint',
  rule: 'porcelain(client-platform-through-ports)',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/client/src/features/access/store.ts',
      content: "import 'react';\n",
    },
  ],
} satisfies Probe;
