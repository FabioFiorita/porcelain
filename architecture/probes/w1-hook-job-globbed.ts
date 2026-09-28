import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants:
    'pnpm check in the Lefthook pre-push filtered by a glob, so a push that misses it skips the gate',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'replace',
      path: 'lefthook.yml',
      old: '    - run: pnpm check\n',
      new: "    - run: pnpm check\n      glob: 'apps/server/**'\n",
    },
  ],
} satisfies Probe;
