import { InvalidLineRangeError } from '@porcelain/kernel/errors';
import { BoxLaneOutOfRangeError } from '../errors/box-lane-out-of-range-error.ts';
import { DuplicateLayerIdError } from '../errors/duplicate-layer-id-error.ts';
import { DuplicateStepIdError } from '../errors/duplicate-step-id-error.ts';
import { ReviewConflictError } from '../errors/review-conflict-error.ts';
import { StepLaneOutOfRangeError } from '../errors/step-lane-out-of-range-error.ts';
import { UnknownArrowBoxError } from '../errors/unknown-arrow-box-error.ts';
import { UnknownArrowStepError } from '../errors/unknown-arrow-step-error.ts';
import { UnknownProofTargetError } from '../errors/unknown-proof-target-error.ts';
import type { CheckReviewDraftInput } from '../models/check-review-draft.ts';
import type { ReviewDraftProblem } from '../models/review.ts';
import type { ReviewStore } from '../ports/review-store.ts';
import { reviewDraftProblem } from '../rules/review-draft.ts';

export class CheckReviewDraftService {
  private readonly reviews: ReviewStore;

  constructor(reviews: ReviewStore) {
    this.reviews = reviews;
  }

  execute(input: CheckReviewDraftInput): void {
    const problem = reviewDraftProblem(input.draft);
    if (problem !== undefined) throw this.invalid(problem);
    const current = this.reviews.read({ worktreeId: input.worktreeId });
    if ((current?.revision ?? 0) !== input.draft.expectedRevision)
      throw new ReviewConflictError();
  }

  private invalid(problem: ReviewDraftProblem): Error {
    switch (problem.kind) {
      case 'duplicate-layer-id':
        return new DuplicateLayerIdError();
      case 'duplicate-step-id':
        return new DuplicateStepIdError();
      case 'reversed-pointer':
        return new InvalidLineRangeError();
      case 'step-lane-out-of-range':
        return new StepLaneOutOfRangeError();
      case 'unknown-arrow-step':
        return new UnknownArrowStepError();
      case 'box-lane-out-of-range':
        return new BoxLaneOutOfRangeError();
      case 'unknown-arrow-box':
        return new UnknownArrowBoxError();
      case 'unknown-proof-target':
        return new UnknownProofTargetError();
    }
  }
}
