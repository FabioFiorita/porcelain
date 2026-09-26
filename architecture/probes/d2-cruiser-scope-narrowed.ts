import type { Probe } from '../probe.ts';

export default {
  decision: 'P25b',
  plants:
    'the circular-import rule narrowed to apps/server/src, and two project rules import each other',
  gate: 'lint',
  rule: 'style(cruiser-config)',
  edits: [
    {
      kind: 'replace',
      path: 'architecture/dependency-cruiser.cjs',
      old: "from: { path: '^(apps/server/src/|packages/)' },",
      new: "from: { path: '^apps/server/src/' },",
    },
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
