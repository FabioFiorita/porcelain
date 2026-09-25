import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a held web architecture count raised in the baseline',
  gate: 'arch',
  rule: 'web-baseline:',
  edits: [
    {
      kind: 'replace',
      path: 'architecture/web-baseline.json',
      old: '"apps/web/src/features/projects/index.ts": 5',
      new: '"apps/web/src/features/projects/index.ts": 6',
    },
  ],
} satisfies Probe;
