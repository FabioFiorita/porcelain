import { reviewDirtyPaths } from '@porcelain/reviews/rules';
import { ReadWorktreeStatusService } from '@porcelain/changes/services';
import { type MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import { type GitIoFailure } from '@porcelain/git/errors';
import { type IncompleteDiffReadError } from '@porcelain/changes/errors';
import { Context, Effect, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { ReadEnvironmentService } from '@porcelain/access/services';
import { type ReadPublishedReviewResponse } from '@porcelain/contracts/reviews';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import {
  ResolvePublishedReviewService,
  ReadPublishedReviewService,
} from '@porcelain/reviews/services';

export class ReadPublishedReviewUseCase extends Context.Service<
  ReadPublishedReviewUseCase,
  {
    readonly execute: (
      input: WorktreeParams,
    ) => Effect.Effect<
      ReadPublishedReviewResponse,
      | MissingEnvironmentIdentityError
      | WorktreeAccessFailure
      | GitIoFailure
      | IncompleteDiffReadError
    >;
  }
>()('@porcelain/server/ReadPublishedReviewUseCase') {
  static readonly layer = Layer.effect(
    ReadPublishedReviewUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const readPublishedReviewCapability = yield* ReadPublishedReviewService;
      const status = yield* ReadWorktreeStatusService;
      const readEnvironmentCapability = yield* ReadEnvironmentService;
      const resolvePublishedReviewCapability =
        yield* ResolvePublishedReviewService;

      return {
        execute: Effect.fn('ReadPublishedReviewUseCase.execute')(function* (
          input: WorktreeParams,
        ): Effect.fn.Return<
          ReadPublishedReviewResponse,
          | MissingEnvironmentIdentityError
          | WorktreeAccessFailure
          | GitIoFailure
          | IncompleteDiffReadError
        > {
          const { worktreeId } = input;
          return yield* accessCapability.reviews(worktreeId, 'read', () =>
            Effect.gen(function* () {
              const published = yield* readPublishedReviewCapability.execute({
                worktreeId,
              });
              if (published.kind === 'none') return { review: undefined };
              const observed = yield* status.execute({ worktreeId });
              const resolved = yield* resolvePublishedReviewCapability.execute({
                environmentId: (yield* readEnvironmentCapability.execute())
                  .environmentId,
                review: published.review,
                headOid: observed.headOid,
                dirtyPaths: reviewDirtyPaths(observed.changes),
              });
              return { review: resolved };
            }),
          );
        }),
      };
    }),
  );
}
