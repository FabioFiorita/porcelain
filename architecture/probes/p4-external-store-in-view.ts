import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a view subscribes to an outside source with useSyncExternalStore',
  gate: 'web-lint',
  rule: 'porcelain(web-no-use-sync-external-store)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        "import { useSyncExternalStore } from 'react';\n\nexport function ProbeView() {\n  const value = useSyncExternalStore(\n    () => () => undefined,\n    () => 'probe',\n  );\n  return <p>{value}</p>;\n}\n",
    },
  ],
} satisfies Probe;
