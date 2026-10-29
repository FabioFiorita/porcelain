import { Context, Effect, Layer } from 'effect';
import {
  ReadReviewService,
  ResolvePublishedReviewService,
  BuildReviewLinksService,
} from '@porcelain/reviews/services';
import type { ReviewNotFoundError } from '@porcelain/reviews/errors';
import {
  reviewPaths,
  reviewRecordView,
  revisionMetadata,
} from '@porcelain/reviews/rules';
import type { Review } from '@porcelain/reviews/models';
import { ReadTextFilesService } from '@porcelain/files/services';
import { ReadEnvironmentService } from '@porcelain/access/services';
import type { MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import type {
  ReadReviewQuery,
  ReadReviewResponse,
  ReviewScope,
} from '@porcelain/contracts/reviews';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { ReviewLinkSource } from '../../ports/review-link-source.ts';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';

export class ReadReviewUseCase extends Context.Service<
  ReadReviewUseCase,
  {
    readonly execute: (
      input: ReviewScope & ReadReviewQuery,
    ) => Effect.Effect<
      ReadReviewResponse,
      | ReviewNotFoundError
      | MissingEnvironmentIdentityError
      | WorktreeAccessFailure
    >;
  }
>()('@porcelain/server/ReadReviewUseCase') {
  static readonly layer = Layer.effect(
    ReadReviewUseCase,
    Effect.gen(function* () {
      const read = yield* ReadReviewService;
      const resolve = yield* ResolvePublishedReviewService;
      const environment = yield* ReadEnvironmentService;
      const links = yield* BuildReviewLinksService;
      const routes = yield* ReviewLinkSource;
      const access = yield* WorktreeAccess;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      const files = yield* ReadTextFilesService;
      const worktreeTexts = (
        worktreeId: string,
        revision: Review,
        latestRevision: number,
      ) =>
        revision.revision !== latestRevision
          ? Effect.succeed(undefined)
          : access
              .reviews(worktreeId, 'read', (worktree) =>
                worktree.branch?.replace(/^refs\/heads\//u, '') ===
                revision.branch
                  ? files.execute({
                      worktreeId,
                      paths: reviewPaths(revision.layers, []),
                    })
                  : Effect.succeed(undefined),
              )
              .pipe(Effect.catch(() => Effect.succeed(undefined)));
      return {
        execute: Effect.fn('ReadReviewUseCase.execute')(function* (input) {
          const result =
            input.reviewId === undefined
              ? yield* access.reviews(input.worktreeId ?? '', 'read', () =>
                  read.execute({
                    worktreeId: input.worktreeId ?? '',
                    revision: input.revision,
                  }),
                )
              : yield* lanes.run(
                  keys.reviews({ repositoryId: `review:${input.reviewId}` }),
                  'read',
                  () =>
                    read.execute({
                      reviewId: input.reviewId ?? '',
                      revision: input.revision,
                    }),
                );
          if (result === undefined)
            return { review: undefined, revisions: [], revision: undefined };
          const { record, revision, revisions } = result;
          const environmentId = (yield* environment.execute()).environmentId;
          const content = yield* resolve.execute({
            environmentId,
            review: revision,
            headOid: revision.headOid,
            worktree: yield* worktreeTexts(
              input.worktreeId ?? revision.worktreeId,
              revision,
              record.latestRevision,
            ),
          });
          return {
            review: reviewRecordView(record),
            revisions: revisions.map(revisionMetadata),
            revision: {
              ...revisionMetadata(revision),
              files: revision.files,
              verdict: revision.verdict,
              content: {
                ...content,
                links: yield* links.execute({
                  review: revision,
                  environmentId,
                  routes: yield* routes.read(),
                }),
              },
            },
          };
        }),
      };
    }),
  );
}
