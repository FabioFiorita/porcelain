import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import {
  type MarkCommentsSeenRequest,
  type MarkCommentsSeenResponse,
} from '@porcelain/contracts/reviews';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import { MarkCommentsSeenService } from '@porcelain/reviews/services';
import { EventPublisher } from '../../ports/event-publisher.ts';

export class MarkCommentsSeenUseCase extends Context.Service<
  MarkCommentsSeenUseCase,
  {
    readonly execute: (
      input: WorktreeParams & MarkCommentsSeenRequest,
    ) => Effect.Effect<MarkCommentsSeenResponse, WorktreeAccessFailure>;
  }
>()('@porcelain/server/MarkCommentsSeenUseCase') {
  static readonly layer = Layer.effect(
    MarkCommentsSeenUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const markCommentsSeenCapability = yield* MarkCommentsSeenService;
      const eventsCapability = yield* EventPublisher;

      return {
        execute: Effect.fn('MarkCommentsSeenUseCase.execute')(function* (
          input: WorktreeParams & MarkCommentsSeenRequest,
        ): Effect.fn.Return<MarkCommentsSeenResponse, WorktreeAccessFailure> {
          return yield* accessCapability
            .transaction(
              input.worktreeId,
              () => Effect.void,
              () => markCommentsSeenCapability.execute(input),
              (value) =>
                Effect.gen(function* () {
                  if (value.changed)
                    yield* eventsCapability.worktreeChanged({
                      worktreeId: input.worktreeId,
                      change: 'comments',
                    });
                }),
            )
            .pipe(
              Effect.map((value) => (({ changed, ...seen }) => seen)(value)),
            );
        }),
      };
    }),
  );
}
