import { type WorktreeChange } from '../../ports/announce-worktree-change-use-case-port.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { InvalidateReviewedMarksUseCasePort } from '../../ports/invalidate-reviewed-marks-use-case-port.ts';
import { Logger } from '../../ports/logger.ts';
import { Cause, Effect, Context, Layer } from 'effect';

export class AnnounceWorktreeChangeUseCase extends Context.Service<
  AnnounceWorktreeChangeUseCase,
  { readonly execute: (input: WorktreeChange) => Effect.Effect<void> }
>()('@porcelain/server/AnnounceWorktreeChangeUseCase') {
  static readonly layer = Layer.effect(
    AnnounceWorktreeChangeUseCase,
    Effect.gen(function* () {
      const invalidateReviewedMarksCapability =
        yield* InvalidateReviewedMarksUseCasePort;
      const eventsCapability = yield* EventPublisher;
      const loggerCapability = yield* Logger;

      return {
        execute: Effect.fn('AnnounceWorktreeChangeUseCase.execute')(function* (
          input: WorktreeChange,
        ): Effect.fn.Return<void> {
          const { worktreeId } = input;
          const paths =
            input.change === 'files' && input.paths.length > 0
              ? input.paths
              : undefined;
          yield* invalidateReviewedMarksCapability
            .execute({ worktreeId, paths })
            .pipe(
              Effect.catchCause((cause) =>
                Effect.sync(() =>
                  loggerCapability.failure({
                    kind: 'reviewed-marks',
                    worktreeId,
                    error: Cause.squash(cause),
                  }),
                ),
              ),
            );
          if (input.change === 'files')
            eventsCapability.filesChanged({ worktreeId, paths: input.paths });
          else eventsCapability.worktreeChanged({ worktreeId, change: 'git' });
        }),
      };
    }),
  );
}
