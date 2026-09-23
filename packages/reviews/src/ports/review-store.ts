import type { StoredReview } from '../models/stored-review.ts';

export interface ReviewStore {
  read(worktreeId: string): StoredReview | undefined;
  readSummary(
    token: string,
  ):
    | Pick<StoredReview, 'summaryHtml' | 'summaryToken' | 'summarySecret'>
    | undefined;
  replace(review: StoredReview, expectedRevision: number): StoredReview;
  setActive(worktreeId: string, revision: number, active: boolean): void;
}
