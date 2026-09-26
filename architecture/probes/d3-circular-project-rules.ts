import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'two new project rules import each other',
  gate: 'arch',
  rule: 'no-circular-source-imports:',
  edits: [
    {
      kind: 'create',
      path: 'packages/projects/src/rules/probe-cycle-a.ts',
      content: "import './probe-cycle-b.ts';\n",
    },
    {
      kind: 'create',
      path: 'packages/projects/src/rules/probe-cycle-b.ts',
      content: "import './probe-cycle-a.ts';\n",
    },
  ],
} satisfies Probe;
