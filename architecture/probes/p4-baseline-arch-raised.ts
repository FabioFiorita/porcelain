import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'the unused web dependencies count raised in the baseline',
  gate: 'arch',
  rule: 'web-baseline:',
  edits: [
    {
      kind: 'replace',
      path: 'architecture/web-baseline.json',
      old: '"apps/web/package.json": 3',
      new: '"apps/web/package.json": 4',
    },
  ],
} satisfies Probe;
