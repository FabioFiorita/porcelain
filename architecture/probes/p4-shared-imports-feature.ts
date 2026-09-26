import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'shared code imports a feature',
  gate: 'arch',
  rule: 'web-shared-imports-no-owner:',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/shared/probe-link.ts',
      content:
        "import { PairingView } from '@/features/access/index';\n\nexport const probeLink = PairingView;\n",
    },
  ],
} satisfies Probe;
