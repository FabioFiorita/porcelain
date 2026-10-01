import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a fixed web architecture finding written back into the baseline',
  gate: 'arch',
  rule: 'web-baseline:',
  edits: [
    {
      kind: 'replace',
      path: 'architecture/web-baseline.json',
      old: '{',
      new: '{\n  "web-shared-cannot-import-ui": {\n    "apps/web/src/shared/workspace/copy.ts": 1\n  },',
    },
  ],
} satisfies Probe;
