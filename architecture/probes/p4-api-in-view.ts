import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a view imports a feature api module',
  gate: 'web-lint',
  rule: 'porcelain(web-views-no-transport)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        "import { createPairingLive } from '../api/pairing-live';\n\nexport const probeLive = createPairingLive;\n",
    },
  ],
} satisfies Probe;
