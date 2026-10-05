import type { ValidatedReviewDraft } from './review.ts';

export type CheckReviewDraftInput = {
  worktreeId: string;
  draft: ValidatedReviewDraft;
};
