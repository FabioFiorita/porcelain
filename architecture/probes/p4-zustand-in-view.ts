import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a view creates its own Zustand store outside store.ts',
  gate: 'web-lint',
  rule: 'porcelain(web-store-owns-zustand)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        "import { create } from 'zustand';\n\nexport const probeStore = create(() => ({ open: false }));\n",
    },
  ],
} satisfies Probe;
