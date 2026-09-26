import type { Probe } from '../probe.ts';

export default {
  decision: 'C5',
  plants:
    'use-cases/changes/read-changes.ts: context.signal?.throwIfAborted() before the consistent read lane',
  gate: 'lint',
  rule: 'porcelain(signals-are-passed)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/changes/read-changes.ts',
      old: '    return this.lanes.runConsistent<ReadChangesResponse>(',
      new: `    context.signal?.throwIfAborted();
    return this.lanes.runConsistent<ReadChangesResponse>(`,
    },
  ],
} satisfies Probe;
