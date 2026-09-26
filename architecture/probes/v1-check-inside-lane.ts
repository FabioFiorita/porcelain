import type { Probe } from '../probe.ts';

export default {
  decision: 'V1',
  plants:
    'use-cases/reviews/mark-comments-seen.ts calls the worktree check helper inside its write lane, where a stale entry would refresh the inventory under the lane',
  gate: 'lint',
  rule: 'porcelain(no-nested-lane)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/reviews/mark-comments-seen.ts',
      old: `      async () => this.markCommentsSeen.execute(input),`,
      new: `      async () => {
        await this.checkWorktree.execute(
          { worktreeId, requireAvailableProject: false },
          context,
        );
        return this.markCommentsSeen.execute(input);
      },`,
    },
  ],
} satisfies Probe;
