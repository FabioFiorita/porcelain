import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'runtime/shared-reads.ts, a file the server structure requires, is deleted',
  gate: 'arch',
  rule: 'missing-server-structure:',
  edits: [{ kind: 'delete', path: 'apps/server/src/runtime/shared-reads.ts' }],
} satisfies Probe;
