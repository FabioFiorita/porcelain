import type { Probe } from '../probe.ts';

export default {
  decision: 'C3',
  plants:
    'new apps/server/src/ports/probe-notice-sink.ts: a server port that takes a contract type without the documented allowance the live channel has',
  gate: 'arch',
  rule: 'server-port-cannot-import-contract',
  edits: [
    {
      kind: 'create',
      path: 'apps/server/src/ports/probe-notice-sink.ts',
      content: `import type { LiveNotice } from '@porcelain/contracts/access';

export type ProbeNoticeSink = { send(notice: LiveNotice): void };
`,
    },
  ],
} satisfies Probe;
