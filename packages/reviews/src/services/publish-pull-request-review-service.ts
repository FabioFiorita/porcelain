import { Clock, Context, DateTime, Effect, Layer } from 'effect';
import type { GitHubReadError } from '../errors/github-read-error.ts';
import type { PullRequestReviewFailedError } from '../errors/pull-request-review-failed-error.ts';
import { ReviewChangedError } from '../errors/review-changed-error.ts';
import type {
  DraftCommentView,
  PostedReview,
} from '../models/draft-comment.ts';
import type { GitHubRepository } from '../models/pull-request.ts';
import { DraftCommentStore } from '../ports/draft-comment-store.ts';
import { PullRequestReviewer } from '../ports/pull-request-reviewer.ts';
import {
  confirmedReview,
  planPullRequestReview,
} from '../rules/draft-comments.ts';

export class PublishPullRequestReviewService extends Context.Service<
  PublishPullRequestReviewService,
  {
    readonly execute: (input: {
      readonly worktreeId: string;
      readonly target: GitHubRepository & {
        readonly account: string;
        readonly number: number;
      };
      readonly comments: readonly DraftCommentView[];
      readonly confirmed: {
        readonly headOid: string;
        readonly summary: string;
        readonly bodies: Readonly<Record<string, string>>;
      };
    }) => Effect.Effect<
      PostedReview,
      GitHubReadError | PullRequestReviewFailedError | ReviewChangedError
    >;
  }
>()('@porcelain/reviews/PublishPullRequestReviewService') {
  static readonly layer = Layer.effect(
    PublishPullRequestReviewService,
    Effect.gen(function* () {
      const reviewer = yield* PullRequestReviewer;
      const store = yield* DraftCommentStore;
      const clock = yield* Clock.Clock;
      return {
        execute: Effect.fn('PublishPullRequestReviewService.execute')(
          function* (input) {
            const diff = yield* reviewer.diff(input.target);
            if (diff.headOid !== input.confirmed.headOid)
              return yield* new ReviewChangedError({
                message:
                  'The pull request has new commits since this preview. Review it again before posting.',
              });
            const review = confirmedReview(
              planPullRequestReview(input.comments, diff),
              input.confirmed,
            );
            if (review === undefined)
              return yield* new ReviewChangedError({
                message:
                  'The comments changed since this preview. Review them again before posting.',
              });
            const posted = yield* reviewer.post({
              ...input.target,
              commitId: diff.headOid,
              body: review.body,
              comments: review.comments,
            });
            yield* store.markPublished({
              worktreeId: input.worktreeId,
              ids: review.ids,
              url: posted.url,
              publishedAt: DateTime.formatIso(
                DateTime.makeUnsafe(yield* clock.currentTimeMillis),
              ),
            });
            return posted;
          },
        ),
      };
    }),
  );
}
