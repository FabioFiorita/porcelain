import type { Probe } from '../probe.ts';

export default {
  decision: 'C5',
  plants:
    'files/services/list-directory-service.ts: signal?.throwIfAborted() after the directory read',
  gate: 'lint',
  rule: 'porcelain(signals-are-passed)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/files/src/services/list-directory-service.ts',
      old: "    if (read.kind === 'failed') throw fileFailureError(read.failure);",
      new: `    signal?.throwIfAborted();
    if (read.kind === 'failed') throw fileFailureError(read.failure);`,
    },
  ],
} satisfies Probe;
