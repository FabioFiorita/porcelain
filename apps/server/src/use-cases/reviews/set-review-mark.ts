import { EventPublisher } from '../../ports/event-publisher.ts';
import { Context, Effect, Layer } from 'effect';
import { SetReviewMarkService } from '@porcelain/reviews/services';
import type {
  ReviewNotFoundError,
  ReviewedMarkConflictError,
} from '@porcelain/reviews/errors';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import type {
  ReviewParams,
  SetReviewMarkRequest,
} from '@porcelain/contracts/reviews';

export class SetReviewMarkUseCase extends Context.Service<
  SetReviewMarkUseCase,
  {
    readonly execute: (
      input: ReviewParams & SetReviewMarkRequest,
    ) => Effect.Effect<
      { updated: boolean },
      ReviewNotFoundError | ReviewedMarkConflictError
    >;
  }
>()('@porcelain/server/SetReviewMarkUseCase') {
  static readonly layer = Layer.effect(
    SetReviewMarkUseCase,
    Effect.gen(function* () {
      const events = yield* EventPublisher;
      const operation = yield* SetReviewMarkService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      return {
        execute: Effect.fn('SetReviewMarkUseCase.execute')(function* (input) {
          return yield* lanes.run(
            keys.reviews({ repositoryId: `review:${input.reviewId}` }),
            'write',
            () => operation.execute(input),
            {
              succeeded: () => events.inventoryChanged(),
            },
          );
        }),
      };
    }),
  );
}
