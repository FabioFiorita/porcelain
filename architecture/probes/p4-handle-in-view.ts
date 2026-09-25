import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a view creates a Base UI dialog handle outside overlays.ts',
  gate: 'web-lint',
  rule: 'porcelain(web-overlays-own-handles)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        "import { Dialog } from '@base-ui/react/dialog';\n\nexport const probeHandle = Dialog.createHandle();\n",
    },
  ],
} satisfies Probe;
