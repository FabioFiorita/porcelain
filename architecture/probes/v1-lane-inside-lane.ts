import type { Probe } from '../probe.ts';

export default {
  decision: 'V1',
  plants:
    'use-cases/reviews/mark-comments-seen.ts takes a second lanes.run inside the callback of its write lane',
  gate: 'lint',
  rule: 'porcelain(no-nested-lane)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/reviews/mark-comments-seen.ts',
      old: `      async () => this.markCommentsSeen.execute(input),`,
      new: `      async () =>
        this.lanes.run(this.laneKeys.reviews(worktree), 'write', async () =>
          this.markCommentsSeen.execute(input),
        ),`,
    },
  ],
} satisfies Probe;
