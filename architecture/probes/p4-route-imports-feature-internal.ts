import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: "a route imports a feature's view file instead of its index.ts",
  gate: 'arch',
  rule: 'web-routes-import-feature-index:',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/routes/probe.tsx',
      content:
        "import { PairingView } from '../features/access/views/pairing-view';\n\nexport const probeRoute = PairingView;\n",
    },
  ],
} satisfies Probe;
