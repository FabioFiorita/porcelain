import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants: 'the fast check deleted from the Lefthook pre-push',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'replace',
      path: 'lefthook.yml',
      old: '    - run: pnpm check\n',
      new: '',
    },
  ],
} satisfies Probe;
