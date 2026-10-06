import type { Probe } from '../probe.ts';

export default {
  decision: 'M1',
  plants: 'shared native Effect state imports Atom React bindings',
  gate: 'lint',
  rule: 'porcelain(client-platform-through-ports)',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/client/src/features/access/store.ts',
      content: "import '@effect/atom-react';\n",
    },
  ],
} satisfies Probe;
