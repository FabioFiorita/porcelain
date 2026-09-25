import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants: 'pnpm arch:web deleted from the pre-push hook',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'replace',
      path: '.githooks/pre-push',
      old: 'pnpm arch:web\n',
      new: '',
    },
  ],
} satisfies Probe;
