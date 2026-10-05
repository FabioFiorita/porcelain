import { Brand, Effect, Context, Layer } from 'effect';
import { InvalidLineRangeError } from '@porcelain/kernel/errors';
import { BoxLaneOutOfRangeError } from '../errors/box-lane-out-of-range-error.ts';
import { DuplicateLayerIdError } from '../errors/duplicate-layer-id-error.ts';
import { DuplicateStepIdError } from '../errors/duplicate-step-id-error.ts';
import { StepLaneOutOfRangeError } from '../errors/step-lane-out-of-range-error.ts';
import { UnknownArrowBoxError } from '../errors/unknown-arrow-box-error.ts';
import { UnknownArrowStepError } from '../errors/unknown-arrow-step-error.ts';
import { UnknownProofTargetError } from '../errors/unknown-proof-target-error.ts';
import {
  type ReviewDraft,
  type ReviewDraftProblem,
  type ValidatedReviewDraft,
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

export class ValidateReviewDraftService extends Context.Service<
  ValidateReviewDraftService,
  {
    readonly execute: (
      input: ReviewDraft,
    ) => Effect.Effect<ValidatedReviewDraft, ReviewDraftFailure>;
  }
>()('@porcelain/reviews/ValidateReviewDraftService') {
  static readonly layer = Layer.effect(
    ValidateReviewDraftService,
    Effect.sync(() => {
      function operationFailure(
        problem: ReviewDraftProblem,
      ): ReviewDraftFailure {
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
      return {
        execute: Effect.fn('ValidateReviewDraftService.execute')(function* (
          input: ReviewDraft,
        ): Effect.fn.Return<ValidatedReviewDraft, ReviewDraftFailure> {
          return yield* Effect.suspend(() => {
            const problem = reviewDraftProblem(input);
            return problem
              ? Effect.fail(operationFailure(problem))
              : Effect.succeed(validatedReviewDraft(structuredClone(input)));
          });
        }),
      };
    }),
  );
}
