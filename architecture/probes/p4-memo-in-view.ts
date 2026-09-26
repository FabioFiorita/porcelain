import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants:
    'a view memoizes by hand with useMemo although the React Compiler memoizes',
  gate: 'web-lint',
  rule: 'porcelain(web-no-manual-memo)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        "import { useMemo } from 'react';\n\nexport function ProbeView(props: { label: string }) {\n  const label = useMemo(() => props.label.trim(), [props.label]);\n  return <p>{label}</p>;\n}\n",
    },
  ],
} satisfies Probe;
