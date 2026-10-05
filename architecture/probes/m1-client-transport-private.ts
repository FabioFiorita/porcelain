import type { Probe } from '../probe.ts';

export default {
  decision: 'M1',
  plants:
    'an app store imports the shared client request implementation directly',
  gate: 'arch',
  rule: 'client-public-api-only:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/web/src/features/access/store.ts',
      content:
        "import '../../../../../packages/client/src/shared/api/transport.ts';\n",
    },
  ],
} satisfies Probe;
