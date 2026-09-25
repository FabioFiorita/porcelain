import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a view calls useQuery itself instead of the read hook in queries/',
  gate: 'web-lint',
  rule: 'porcelain(web-queries-own-reads)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        "import { useQuery } from '@tanstack/react-query';\n\nexport function ProbeView() {\n  const probe = useQuery({\n    queryKey: ['access', 'probe'],\n    queryFn: () => 'probe',\n  });\n  return <p>{probe.data}</p>;\n}\n",
    },
  ],
} satisfies Probe;
