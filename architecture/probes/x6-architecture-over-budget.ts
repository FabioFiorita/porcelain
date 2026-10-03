import type { Probe } from '../probe.ts';

export default {
  decision: 'SIZE',
  plants: 'architecture source grows past its reviewed line budget',
  gate: 'lint',
  rule: 'style(architecture-budget)',
  edits: [
    {
      kind: 'create',
      path: 'architecture/probe-budget.mjs',
      content: '\n'.repeat(18_001),
    },
  ],
} satisfies Probe;
