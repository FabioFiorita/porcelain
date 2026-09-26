import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants: 'pnpm test deleted from the server group of the Lefthook pre-push',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'replace',
      path: 'lefthook.yml',
      old: '          - run: pnpm test\n',
      new: '',
    },
  ],
} satisfies Probe;
