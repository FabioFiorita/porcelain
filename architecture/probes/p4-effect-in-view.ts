import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants:
    'a view runs useEffect instead of leaving imperative glue to an adapter',
  gate: 'web-lint',
  rule: 'porcelain(web-effects-in-adapters)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        "import { useEffect } from 'react';\n\nexport function ProbeView() {\n  useEffect(() => undefined, []);\n  return <p />;\n}\n",
    },
  ],
} satisfies Probe;
