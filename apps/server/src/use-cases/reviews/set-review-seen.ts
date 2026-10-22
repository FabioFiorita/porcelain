import type {
  ReviewParams,
  SetReviewSeenRequest,
} from '@porcelain/contracts/reviews';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { Context, Effect, Layer } from 'effect';
import { SetReviewSeenService } from '@porcelain/reviews/services';
import type { ReviewNotFoundError } from '@porcelain/reviews/errors';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';

export class SetReviewSeenUseCase extends Context.Service<
  SetReviewSeenUseCase,
  {
    readonly execute: (
      input: ReviewParams & SetReviewSeenRequest,
    ) => Effect.Effect<{ updated: boolean }, ReviewNotFoundError>;
  }
>()('@porcelain/server/SetReviewSeenUseCase') {
  static readonly layer = Layer.effect(
    SetReviewSeenUseCase,
    Effect.gen(function* () {
      const events = yield* EventPublisher;
      const operation = yield* SetReviewSeenService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      return {
        execute: Effect.fn('SetReviewSeenUseCase.execute')(function* (input) {
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
