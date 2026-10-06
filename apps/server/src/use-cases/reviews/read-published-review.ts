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
import { ReadReviewEvidenceUseCasePort } from '../../ports/read-review-evidence-use-case-port.ts';

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
      const readReviewEvidenceCapability = yield* ReadReviewEvidenceUseCasePort;
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
              const evidence = yield* readReviewEvidenceCapability.execute({
                worktreeId,
                layers: published.review.layers,
              });
              const resolved = yield* resolvePublishedReviewCapability.execute({
                environmentId: (yield* readEnvironmentCapability.execute())
                  .environmentId,
                review: published.review,
                evidence,
              });
              return { review: resolved };
            }),
          );
        }),
      };
    }),
  );
}
