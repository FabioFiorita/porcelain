import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants: 'the pre-push fast check replaced with a narrower web lint command',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'replace',
      path: 'lefthook.yml',
      old: '    - run: pnpm check\n',
      new: '    - run: pnpm lint:web\n',
    },
  ],
} satisfies Probe;
