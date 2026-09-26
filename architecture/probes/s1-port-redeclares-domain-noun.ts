import type { Probe } from '../probe.ts';

export default {
  decision: 'S1',
  plants:
    'new packages/reviews/src/ports/worktree-change-reader.ts that declares its own copy of the changes domain shape (no import)',
  gate: 'lint',
  rule: 'porcelain(port-shape)',
  edits: [
    {
      kind: 'create',
      path: 'packages/reviews/src/ports/worktree-change-reader.ts',
      content: `export interface WorktreeChangeReader {
  read(
    input: { worktreeId: string },
    signal?: AbortSignal,
  ): Promise<{ statusToken: string; changes: { path: string; fingerprint: string }[] }>;
}
`,
    },
  ],
} satisfies Probe;
