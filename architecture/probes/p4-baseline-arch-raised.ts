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
      old: '"web-shared-cannot-import-ui": {\n    "apps/web/src/shared/workspace/copy.ts": 1',
      new: '"web-shared-cannot-import-ui": {\n    "apps/web/src/shared/workspace/copy.ts": 2',
    },
  ],
} satisfies Probe;
