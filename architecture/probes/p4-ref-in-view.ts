import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a view holds a DOM handle in useRef',
  gate: 'web-lint',
  rule: 'porcelain(web-refs-in-adapters)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        "import { useRef } from 'react';\n\nexport function ProbeView() {\n  const node = useRef<HTMLParagraphElement>(null);\n  return <p ref={node} />;\n}\n",
    },
  ],
} satisfies Probe;
