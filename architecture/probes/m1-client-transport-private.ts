import type { Probe } from '../probe.ts';

export default {
  decision: 'M1',
  plants:
    'a feature API imports the shared client request implementation directly',
  gate: 'arch',
  rule: 'client-public-api-only:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/web/src/features/access/api.ts',
      content:
        "import '../../../../../packages/client/src/shared/api/request.ts';\n",
    },
  ],
} satisfies Probe;
