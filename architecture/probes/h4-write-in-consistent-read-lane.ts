import type { Probe } from '../probe.ts';

export default {
  decision: 'H4',
  plants:
    'use-cases/reviews/mark-comments-seen.ts runs its write inside lanes.runConsistent, which is a read lane',
  gate: 'arch',
  rule: 'lane-mode-matches-service:',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/reviews/mark-comments-seen.ts',
      old: `    const { changed, ...seen } = await this.lanes.run(
      this.laneKeys.reviews(worktree),
      'write',`,
      new: `    const { changed, ...seen } = await this.lanes.runConsistent(
      this.laneKeys.reviews(worktree),
      worktree,`,
    },
  ],
} satisfies Probe;
