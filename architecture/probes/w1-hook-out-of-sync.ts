import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants:
    'a pre-commit job added to lefthook.yml after the hook was installed, so the installed hook no longer matches the configuration',
  gate: 'lint',
  rule: 'style(pre-push-hook)',
  edits: [
    {
      kind: 'append',
      path: 'lefthook.yml',
      content: 'pre-commit:\n  jobs:\n    - run: pnpm lint:server\n',
    },
  ],
} satisfies Probe;
