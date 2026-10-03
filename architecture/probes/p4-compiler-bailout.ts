import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants:
    'an adapter component reads a ref during render, which the React Compiler cannot compile',
  gate: 'web-lint',
  rule: 'style(react-compiler)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/adapters/probe-adapter.tsx',
      content:
        "import { useRef } from 'react';\n\nexport function ProbeAdapter() {\n  const node = useRef<HTMLDivElement>(null);\n  return <div ref={node}>{node.current?.id}</div>;\n}\n",
    },
  ],
} satisfies Probe;
