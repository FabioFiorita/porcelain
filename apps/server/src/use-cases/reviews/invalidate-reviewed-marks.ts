import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { type InvalidateReviewedMarksInput } from '@porcelain/reviews/models';
import { InvalidateReviewedMarksService } from '@porcelain/reviews/services';
import { EventPublisher } from '../../ports/event-publisher.ts';

export class InvalidateReviewedMarksUseCase extends Context.Service<
  InvalidateReviewedMarksUseCase,
  {
    readonly execute: (
      input: InvalidateReviewedMarksInput,
    ) => Effect.Effect<void, WorktreeAccessFailure>;
  }
>()('@porcelain/server/InvalidateReviewedMarksUseCase') {
  static readonly layer = Layer.effect(
    InvalidateReviewedMarksUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const invalidateReviewedMarksCapability =
        yield* InvalidateReviewedMarksService;
      const eventsCapability = yield* EventPublisher;

      return {
        execute: Effect.fn('InvalidateReviewedMarksUseCase.execute')(function* (
          input: InvalidateReviewedMarksInput,
        ): Effect.fn.Return<void, WorktreeAccessFailure> {
          return yield* accessCapability
            .transaction(
              input.worktreeId,
              () => Effect.void,
              () => invalidateReviewedMarksCapability.execute(input),
              (value) =>
                Effect.sync(() => {
                  if (value.changed)
                    eventsCapability.worktreeChanged({
                      worktreeId: input.worktreeId,
                      change: 'reviewed',
                    });
                }),
            )
            .pipe(Effect.asVoid);
        }),
      };
    }),
  );
}
