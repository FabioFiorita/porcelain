import { Brand, Effect } from 'effect';
import { InvalidLineRangeError } from '@porcelain/kernel/errors';
import { BoxLaneOutOfRangeError } from '../errors/box-lane-out-of-range-error.ts';
import { DuplicateLayerIdError } from '../errors/duplicate-layer-id-error.ts';
import { DuplicateStepIdError } from '../errors/duplicate-step-id-error.ts';
import { StepLaneOutOfRangeError } from '../errors/step-lane-out-of-range-error.ts';
import { UnknownArrowBoxError } from '../errors/unknown-arrow-box-error.ts';
import { UnknownArrowStepError } from '../errors/unknown-arrow-step-error.ts';
import { UnknownProofTargetError } from '../errors/unknown-proof-target-error.ts';

import type {
  ReviewDraft,
  ReviewDraftProblem,
  ValidatedReviewDraft,
} from '../models/review.ts';
import { reviewDraftProblem } from '../rules/review-draft.ts';

const validatedReviewDraft = Brand.nominal<ValidatedReviewDraft>();

export type ReviewDraftFailure =
  | DuplicateLayerIdError
  | DuplicateStepIdError
  | InvalidLineRangeError
  | StepLaneOutOfRangeError
  | UnknownArrowStepError
  | BoxLaneOutOfRangeError
  | UnknownArrowBoxError
  | UnknownProofTargetError;

export class ValidateReviewDraftService {
  execute(
    input: ReviewDraft,
  ): Effect.Effect<ValidatedReviewDraft, ReviewDraftFailure> {
    return Effect.suspend(() => {
      const problem = reviewDraftProblem(input);
      return problem
        ? Effect.fail(this.failure(problem))
        : Effect.succeed(validatedReviewDraft(structuredClone(input)));
    });
  }

  private failure(problem: ReviewDraftProblem): ReviewDraftFailure {
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
