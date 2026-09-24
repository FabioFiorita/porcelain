import type { Probe } from '../probe.ts';

export default {
  decision: 'C5',
  plants:
    'files/services/list-directory-service.ts: `const { aborted } = signal ?? { aborted: false }` then an early throw',
  gate: 'lint',
  rule: 'porcelain(signals-are-passed)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/files/src/services/list-directory-service.ts',
      old: "    if (read.kind === 'failed') throw fileFailureError(read.failure);",
      new: `    const { aborted } = signal ?? { aborted: false };
    if (aborted) throw new DirectoryTooLargeError();
    if (read.kind === 'failed') throw fileFailureError(read.failure);`,
    },
  ],
} satisfies Probe;
