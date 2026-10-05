import { type GitIoFailure } from '@porcelain/git/errors';
import { type IncompleteDiffReadError } from '@porcelain/changes/errors';
import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { type WorktreeKey } from '@porcelain/kernel/models';
import {
  ReadPublishedReviewService,
  RecordReviewActivityService,
} from '@porcelain/reviews/services';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { ReadReviewEvidenceUseCasePort } from '../../ports/read-review-evidence-use-case-port.ts';

export class RefreshWorktreeReviewUseCase extends Context.Service<
  RefreshWorktreeReviewUseCase,
  {
    readonly execute: (
      input: WorktreeKey,
    ) => Effect.Effect<
      void,
      WorktreeAccessFailure | GitIoFailure | IncompleteDiffReadError
    >;
  }
>()('@porcelain/server/RefreshWorktreeReviewUseCase') {
  static readonly layer = Layer.effect(
    RefreshWorktreeReviewUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const readPublishedReviewCapability = yield* ReadPublishedReviewService;
      const readReviewEvidenceCapability = yield* ReadReviewEvidenceUseCasePort;
      const recordReviewActivityCapability = yield* RecordReviewActivityService;
      const eventsCapability = yield* EventPublisher;

      return {
        execute: Effect.fn('RefreshWorktreeReviewUseCase.execute')(function* (
          input: WorktreeKey,
        ): Effect.fn.Return<
          void,
          WorktreeAccessFailure | GitIoFailure | IncompleteDiffReadError
        > {
          return yield* Effect.suspend(() => {
            const { worktreeId } = input;
            return accessCapability
              .transaction(
                worktreeId,
                () =>
                  Effect.gen(function* () {
                    const published =
                      yield* readPublishedReviewCapability.execute({
                        worktreeId,
                      });
                    if (published.kind === 'none') return undefined;
                    const evidence =
                      yield* readReviewEvidenceCapability.execute({
                        worktreeId,
                        layers: published.review.layers,
                      });
                    return { review: published.review, evidence };
                  }),
                (prepared) =>
                  prepared
                    ? recordReviewActivityCapability.execute(prepared)
                    : Effect.succeed({ changed: false }),
                ({ changed }) =>
                  Effect.gen(function* () {
                    if (changed)
                      yield* eventsCapability.worktreeChanged({
                        worktreeId,
                        change: 'review',
                      });
                  }),
              )
              .pipe(Effect.asVoid);
          });
        }),
      };
    }),
  );
}
