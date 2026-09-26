import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants:
    'pnpm test in the Lefthook pre-push filtered by a glob, so a push that misses it skips the gate',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'replace',
      path: 'lefthook.yml',
      old: '          - run: pnpm test\n',
      new: "          - run: pnpm test\n            glob: 'apps/server/**'\n",
    },
  ],
} satisfies Probe;
