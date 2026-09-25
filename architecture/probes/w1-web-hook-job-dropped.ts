import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants: 'pnpm lint:web deleted from the web group of the Lefthook pre-push',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'replace',
      path: 'lefthook.yml',
      old: '          - run: pnpm lint:web\n',
      new: '',
    },
  ],
} satisfies Probe;
