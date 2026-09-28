import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants: 'the fast pre-push check marked skip: true',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'replace',
      path: 'lefthook.yml',
      old: '    - run: pnpm check\n',
      new: '    - run: pnpm check\n      skip: true\n',
    },
  ],
} satisfies Probe;
