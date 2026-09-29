import type { ReviewDraft } from './review.ts';

export type CheckReviewDraftInput = {
  worktreeId: string;
  draft: ReviewDraft;
};
