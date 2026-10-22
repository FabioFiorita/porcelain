import type {
  ReviewParams,
  SetReviewStateRequest,
} from '@porcelain/contracts/reviews';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { Context, Effect, Layer } from 'effect';
import { SetReviewStateService } from '@porcelain/reviews/services';
import type { ReviewNotFoundError } from '@porcelain/reviews/errors';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';

export class SetReviewStateUseCase extends Context.Service<
  SetReviewStateUseCase,
  {
    readonly execute: (
      input: ReviewParams & SetReviewStateRequest,
    ) => Effect.Effect<{ updated: boolean }, ReviewNotFoundError>;
  }
>()('@porcelain/server/SetReviewStateUseCase') {
  static readonly layer = Layer.effect(
    SetReviewStateUseCase,
    Effect.gen(function* () {
      const events = yield* EventPublisher;
      const operation = yield* SetReviewStateService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      return {
        execute: Effect.fn('SetReviewStateUseCase.execute')(function* (input) {
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
