import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a feature rule imports React',
  gate: 'web-lint',
  rule: 'porcelain(web-rules-are-pure)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/rules/probe-rule.ts',
      content:
        "import { useState } from 'react';\n\nexport const probeHook = useState;\n",
    },
  ],
} satisfies Probe;
