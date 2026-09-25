import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a feature view imports its api.ts directly',
  gate: 'arch',
  rule: 'view-cannot-import-api:',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/api.ts',
      content: "export const probeApi = 'probe';\n",
    },
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        "import { probeApi } from '../api';\n\nexport const ProbeView = () => <p>{probeApi}</p>;\n",
    },
  ],
} satisfies Probe;
