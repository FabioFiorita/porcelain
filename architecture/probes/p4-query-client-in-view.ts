import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a view reaches the query client directly',
  gate: 'web-lint',
  rule: 'porcelain(web-views-no-direct-data)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        "import { useQueryClient } from '@tanstack/react-query';\n\nexport const probeClient = useQueryClient;\n",
    },
  ],
} satisfies Probe;
