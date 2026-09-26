import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants: 'the web group of the Lefthook pre-push marked skip: true',
  gate: 'lint',
  rule: 'style(ci-steps)',
  edits: [
    {
      kind: 'replace',
      path: 'lefthook.yml',
      old: '    - name: web\n',
      new: '    - name: web\n      skip: true\n',
    },
  ],
} satisfies Probe;
