import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants: 'the fast pre-push check limited to pushes from main',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'replace',
      path: 'lefthook.yml',
      old: '    - run: pnpm check\n',
      new: '    - run: pnpm check\n      only:\n        - ref: main\n',
    },
  ],
} satisfies Probe;
