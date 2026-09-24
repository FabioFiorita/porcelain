import type { Probe } from '../probe.ts';

export default {
  decision: 'H3',
  plants:
    'use-cases/git-actions/run-git-action.ts publishes a review change from refreshReview, which runs inside lanes.background',
  gate: 'lint',
  rule: 'porcelain(events-after-lane)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/git-actions/run-git-action.ts',
      old: `    this.recordReviewActivity.execute({ review: published.review, evidence });`,
      new: `    this.recordReviewActivity.execute({ review: published.review, evidence });
    this.events.worktreeChanged({ worktreeId, change: 'review' });`,
    },
  ],
} satisfies Probe;
