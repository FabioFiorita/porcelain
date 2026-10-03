import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'use-cases/files/list-directory.ts imports list-directory-service.ts by path instead of the services entry',
  gate: 'arch',
  rule: 'domain-public-api-only:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/server/src/use-cases/files/list-directory.ts',
      content:
        "import '../../../../../packages/files/src/services/list-directory-service.ts';\n",
    },
  ],
} satisfies Probe;
