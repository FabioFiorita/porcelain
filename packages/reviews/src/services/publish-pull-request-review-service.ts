import { Clock, Context, DateTime, Effect, Layer } from 'effect';
import { PullRequestReviewFailedError } from '../errors/pull-request-review-failed-error.ts';
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
  openDraftRevision,
  planPullRequestReview,
} from '../rules/draft-comments.ts';

function failure(problem: string) {
  return Effect.fail(
    new PullRequestReviewFailedError({
      message:
        problem === 'no-pull-request'
          ? 'This branch has no open pull request.'
          : problem === 'github-read'
            ? 'GitHub could not be read. Check your connection and try again.'
            : 'GitHub is not available for this project right now.',
    }),
  );
}

export class PublishPullRequestReviewService extends Context.Service<
  PublishPullRequestReviewService,
  {
    readonly execute: (input: {
      readonly worktreeId: string;
      readonly target:
        | (GitHubRepository & {
            readonly account: string;
            readonly number: number;
          })
        | { readonly unavailable: string };
      readonly comments: readonly DraftCommentView[];
      readonly confirmed: {
        readonly pullRequest: GitHubRepository & { readonly number: number };
        readonly headOid: string;
        readonly draftRevision: string;
        readonly inlineIds: readonly string[];
        readonly summary: string;
        readonly bodies: Readonly<Record<string, string>>;
      };
    }) => Effect.Effect<
      PostedReview,
      PullRequestReviewFailedError | ReviewChangedError
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
            const target = input.target;
            if (
              !input.comments.some(
                ({ publication }) => publication.status === 'draft',
              )
            )
              return yield* new ReviewChangedError({
                message:
                  'There are no drafts left to post. Go back to see the current comments.',
              });
            if ('unavailable' in target)
              return yield* failure(target.unavailable);
            const previewed = input.confirmed.pullRequest;
            if (
              target.owner.toLowerCase() !== previewed.owner.toLowerCase() ||
              target.repo.toLowerCase() !== previewed.repo.toLowerCase() ||
              target.number !== previewed.number
            )
              return yield* new ReviewChangedError({
                message:
                  'The destination pull request changed. Go back and preview the review again.',
              });
            if (
              openDraftRevision(input.comments) !==
              input.confirmed.draftRevision
            )
              return yield* new ReviewChangedError({
                message:
                  'The comments changed since this preview. Review them again before posting.',
              });
            const diff = yield* reviewer
              .diff(target)
              .pipe(
                Effect.catchTag('GitHubReadError', () =>
                  failure('github-read'),
                ),
              );
            if (diff.headOid !== input.confirmed.headOid)
              return yield* new ReviewChangedError({
                message:
                  'The pull request has new commits since this preview. Review it again before posting.',
              });
            const plan = planPullRequestReview(input.comments, diff);
            const inlineIds = new Set(input.confirmed.inlineIds);
            if (
              plan.inline.length !== inlineIds.size ||
              plan.inline.some(({ id }) => !inlineIds.has(id))
            )
              return yield* new ReviewChangedError({
                message:
                  'Where a comment will appear changed. Go back and preview the review again.',
              });
            const review = confirmedReview(plan, input.confirmed);
            if (review === undefined)
              return yield* new ReviewChangedError({
                message:
                  'The comments changed since this preview. Review them again before posting.',
              });
            const posted = yield* reviewer.post({
              ...target,
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
