import type { Probe } from '../probe.ts';

export default {
  decision: 'C5',
  plants:
    'use-cases/changes/read-changes.ts: context.signal?.throwIfAborted() before the read lane',
  gate: 'lint',
  rule: 'porcelain(signals-are-passed)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/changes/read-changes.ts',
      old: '    return this.lanes.run<ReadChangesResponse>(',
      new: `    context.signal?.throwIfAborted();
    return this.lanes.run<ReadChangesResponse>(`,
    },
  ],
} satisfies Probe;
