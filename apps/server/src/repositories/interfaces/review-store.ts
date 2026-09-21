import type { StoredReview } from '../../models/review.ts';

export interface ReviewStore {
  read(worktreeId: string): StoredReview | null;
  readSummary(
    token: string,
  ): Pick<
    StoredReview,
    'summaryHtml' | 'summaryToken' | 'summarySecret'
  > | null;
  replace(review: StoredReview, expectedRevision: number): StoredReview;
  setActive(worktreeId: string, revision: number, active: boolean): void;
}
