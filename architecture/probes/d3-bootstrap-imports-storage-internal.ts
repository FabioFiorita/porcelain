import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'compose-files.ts imports a storage db file by path instead of the storage entry',
  gate: 'arch',
  rule: 'storage-public-api-only:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/server/src/bootstrap/compose-files.ts',
      content: "import '../../../../packages/storage/src/db/connection.ts';\n",
    },
  ],
} satisfies Probe;
