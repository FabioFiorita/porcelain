import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants:
    'a lefthook-local.yml that skips the web group, which Lefthook merges over lefthook.yml',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'create',
      path: 'lefthook-local.yml',
      content: 'pre-push:\n  jobs:\n    - name: web\n      skip: true\n',
    },
  ],
} satisfies Probe;
