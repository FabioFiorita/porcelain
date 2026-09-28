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
      old: '"unclassified-source": {\n    "apps/web/src/app/api.ts": 1',
      new: '"unclassified-source": {\n    "apps/web/src/app/api.ts": 2',
    },
  ],
} satisfies Probe;
