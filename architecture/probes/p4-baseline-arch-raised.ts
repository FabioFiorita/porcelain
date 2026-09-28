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
      old: '"web-nothing-imports-routes": {\n    "apps/web/src/main.tsx": 1',
      new: '"web-nothing-imports-routes": {\n    "apps/web/src/main.tsx": 2',
    },
  ],
} satisfies Probe;
