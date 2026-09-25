import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a feature view keeps action-driven state in useReducer',
  gate: 'web-lint',
  rule: 'porcelain(web-no-use-reducer)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        "import { useReducer } from 'react';\n\nexport function ProbeView() {\n  const [count] = useReducer((value: number) => value, 0);\n  return <p>{count}</p>;\n}\n",
    },
  ],
} satisfies Probe;
