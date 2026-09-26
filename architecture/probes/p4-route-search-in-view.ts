import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants:
    'a view reads the route search itself instead of getting it from its route',
  gate: 'web-lint',
  rule: 'porcelain(web-views-no-direct-data)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        "import { useSearch } from '@tanstack/react-router';\n\nexport const probeSearch = useSearch;\n",
    },
  ],
} satisfies Probe;
