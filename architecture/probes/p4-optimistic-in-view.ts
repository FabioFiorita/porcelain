import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants:
    'a view holds an optimistic value with useOptimistic instead of the command',
  gate: 'web-lint',
  rule: 'porcelain(web-no-action-hooks)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        "import { useOptimistic } from 'react';\n\nexport function ProbeView() {\n  const [value] = useOptimistic('probe');\n  return <p>{value}</p>;\n}\n",
    },
  ],
} satisfies Probe;
