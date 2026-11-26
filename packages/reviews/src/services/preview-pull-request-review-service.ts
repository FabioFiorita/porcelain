import { Context, Effect, Layer } from 'effect';
import type { GitHubReadError } from '../errors/github-read-error.ts';
import type { DraftCommentView, ReviewPlan } from '../models/draft-comment.ts';
import type { GitHubRepository } from '../models/pull-request.ts';
import { PullRequestReviewer } from '../ports/pull-request-reviewer.ts';
import {
  openDraftRevision,
  planPullRequestReview,
} from '../rules/draft-comments.ts';

export class PreviewPullRequestReviewService extends Context.Service<
  PreviewPullRequestReviewService,
  {
    readonly execute: (input: {
      readonly target: GitHubRepository & {
        readonly account: string;
        readonly number: number;
      };
      readonly comments: readonly DraftCommentView[];
    }) => Effect.Effect<
      ReviewPlan & { headOid: string; draftRevision: string },
      GitHubReadError
    >;
  }
>()('@porcelain/reviews/PreviewPullRequestReviewService') {
  static readonly layer = Layer.effect(
    PreviewPullRequestReviewService,
    Effect.gen(function* () {
      const reviewer = yield* PullRequestReviewer;
      return {
        execute: Effect.fn('PreviewPullRequestReviewService.execute')(
          function* (input) {
            const diff = yield* reviewer.diff(input.target);
            return {
              headOid: diff.headOid,
              draftRevision: openDraftRevision(input.comments),
              ...planPullRequestReview(input.comments, diff),
            };
          },
        ),
      };
    }),
  );
}
