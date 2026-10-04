import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants: 'mobile imports file reads without mapping their routes',
  gate: 'features',
  rule: 'the mobile calls GET /api/worktrees/:worktreeId/directory: no map file lists it',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/mobile/src/features/access/queries/environments.ts',
      content:
        "import { directoryQueryOptions } from '@porcelain/client/files';\nexport const probeDirectory = directoryQueryOptions;\n",
    },
  ],
} satisfies Probe;
