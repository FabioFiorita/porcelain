import type { Probe } from '../probe.ts';

export default {
  decision: 'C3',
  plants:
    'apps/server/src/ports/live-channel.ts imports a contract value, not only the notice type its allowance covers',
  gate: 'arch',
  rule: 'server-port-cannot-import-contract:',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/ports/live-channel.ts',
      old: "import type { LiveNotice } from '@porcelain/contracts/access';",
      new: "import { liveNoticeSchema, type LiveNotice } from '@porcelain/contracts/access';\nexport const probeSchema = liveNoticeSchema;",
    },
  ],
} satisfies Probe;
