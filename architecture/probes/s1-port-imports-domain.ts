import type { Probe } from '../probe.ts';

export default {
  decision: 'S1',
  plants:
    'new packages/reviews/src/ports/worktree-change-reader.ts importing ReadWorktreeStatusResult from @porcelain/changes/models',
  gate: 'lint',
  rule: 'porcelain(port-shape)',
  edits: [
    {
      kind: 'create',
      path: 'packages/reviews/src/ports/worktree-change-reader.ts',
      content: `import type { ReadWorktreeStatusResult } from '@porcelain/changes/models';

export interface WorktreeChangeReader {
  read(
    input: { worktreeId: string },
    signal?: AbortSignal,
  ): Promise<ReadWorktreeStatusResult>;
}
`,
    },
  ],
} satisfies Probe;
