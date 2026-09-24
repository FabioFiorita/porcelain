import type { Probe } from '../probe.ts';

export default {
  decision: 'H1',
  plants:
    'use-cases/reviews/mark-comments-seen.ts writes the comment-seen table in the access lane instead of its worktree lane',
  gate: 'arch',
  rule: 'lane-per-table',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/reviews/mark-comments-seen.ts',
      old: `      this.laneKeys.reviews(worktree),`,
      new: `      this.laneKeys.access(),`,
    },
  ],
} satisfies Probe;
