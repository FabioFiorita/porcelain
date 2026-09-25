import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants:
    'the server group of the Lefthook pre-push limited by only to pushes from main',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'replace',
      path: 'lefthook.yml',
      old: '    - name: server\n',
      new: '    - name: server\n      only:\n        - ref: main\n',
    },
  ],
} satisfies Probe;
