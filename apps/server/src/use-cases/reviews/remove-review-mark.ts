import { EventPublisher } from '../../ports/event-publisher.ts';
import { Context, Effect, Exit, Layer } from 'effect';
import { RemoveReviewMarkService } from '@porcelain/reviews/services';
import type { ReviewNotFoundError } from '@porcelain/reviews/errors';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import type { RemoveReviewMarkRequest } from '@porcelain/contracts/reviews';

export class RemoveReviewMarkUseCase extends Context.Service<
  RemoveReviewMarkUseCase,
  {
    readonly execute: (
      input: { reviewId: string } & RemoveReviewMarkRequest,
    ) => Effect.Effect<{ updated: boolean }, ReviewNotFoundError>;
  }
>()('@porcelain/server/RemoveReviewMarkUseCase') {
  static readonly layer = Layer.effect(
    RemoveReviewMarkUseCase,
    Effect.gen(function* () {
      const events = yield* EventPublisher;
      const operation = yield* RemoveReviewMarkService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      return {
        execute: Effect.fn('RemoveReviewMarkUseCase.execute')(
          function* (input) {
            return yield* lanes.run(
              keys.reviews({ repositoryId: `review:${input.reviewId}` }),
              'write',
              () => operation.execute(input),
              {
                settled: (exit) =>
                  Exit.isSuccess(exit)
                    ? events.inventoryChanged()
                    : Effect.void,
              },
            );
          },
        ),
      };
    }),
  );
}
