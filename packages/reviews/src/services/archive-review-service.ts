import { reviewPullRequestsMatch } from '../rules/review-publication.ts';
import { Context, Effect, Layer } from 'effect';
import type {
  ArchiveReviewRequest,
  ReviewArchivePlan,
} from '../models/review-archive.ts';
import { ReviewArchiveRefusedError } from '../errors/review-archive-refused-error.ts';
import { ReviewNotFoundError } from '../errors/review-not-found-error.ts';
import { ReviewArchiver } from '../ports/review-archiver.ts';
import { ReviewStore } from '../ports/review-store.ts';
export class ArchiveReviewService extends Context.Service<
  ArchiveReviewService,
  {
    readonly execute: (
      input: ArchiveReviewRequest & {
        reviewId: string;
        pullRequestClosed: boolean;
        observedPullRequest: string | undefined;
        mergedHead?: string | undefined;
        repositoryIdentity: string;
      },
    ) => Effect.Effect<
      { archived: boolean; plan: ReviewArchivePlan },
      ReviewNotFoundError | ReviewArchiveRefusedError
    >;
  }
>()('@porcelain/reviews/ArchiveReviewService') {
  static readonly layer = Layer.effect(
    ArchiveReviewService,
    Effect.gen(function* () {
      const reviews = yield* ReviewStore;
      const archiver = yield* ReviewArchiver;
      return {
        execute: Effect.fn('ArchiveReviewService.execute')(function* (input) {
          const record = yield* reviews.readRecord(input);
          const revision = yield* reviews.read(input);
          if (!record || !revision) return yield* new ReviewNotFoundError();
          if (
            !record.pullRequest ||
            !input.pullRequestClosed ||
            !reviewPullRequestsMatch(
              record.pullRequest,
              input.observedPullRequest,
            )
          )
            return yield* new ReviewArchiveRefusedError({
              message:
                'Only reviews with a merged or closed pull request can be archived. Refresh the pull request and retry.',
            });
          if (record.archived)
            return yield* new ReviewArchiveRefusedError({
              message: 'This review is already archived.',
            });
          const plan = yield* archiver.execute({
            ...input,
            commonDirectory: record.commonDirectory,
            worktreePath: revision.worktreePath,
            branch: record.branch,
          });
          if (input.confirmation) yield* reviews.archive(input);
          return { archived: input.confirmation !== undefined, plan };
        }),
      };
    }),
  );
}
