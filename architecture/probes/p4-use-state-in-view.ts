import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants:
    'a feature view keeps a counter in useState instead of the feature store',
  gate: 'web-lint',
  rule: 'porcelain(web-no-use-state)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        "import { useState } from 'react';\n\nexport function ProbeView() {\n  const [count] = useState(0);\n  return <p>{count}</p>;\n}\n",
    },
  ],
} satisfies Probe;
