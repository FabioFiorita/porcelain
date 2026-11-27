import { Effect, Layer, Schema } from 'effect';
import {
  captureGitPlatform,
  postGitHubPullRequestReview,
  readGitHubApi,
} from '@porcelain/git/discovery';
import {
  GitHubReadError,
  PullRequestReviewFailedError,
} from '@porcelain/reviews/errors';
import type { PullRequestFile } from '@porcelain/reviews/models';
import { PullRequestReviewer } from '@porcelain/reviews/ports';
import type { Limits } from '../../config/limits.ts';
import { lacksAccess, type GitHubAccessMemo } from './github-access-memo.ts';

const FILES_PER_PAGE = 100;
const MAX_FILE_PAGES = 30;

const pullSchema = Schema.fromJsonString(
  Schema.Struct({ head: Schema.Struct({ sha: Schema.String }) }),
);
const filesSchema = Schema.fromJsonString(
  Schema.Array(
    Schema.Struct({
      filename: Schema.String,
      patch: Schema.optional(Schema.String),
    }),
  ),
);

const unavailable = (error: {
  readonly reason: GitHubReadError['reason'] | 'not-found';
}) =>
  new GitHubReadError({
    reason: error.reason === 'not-found' ? 'invalid-response' : error.reason,
  });

export const ghPullRequestReviewerLayer = (
  limits: Limits['git'],
  access: GitHubAccessMemo,
) =>
  Layer.effect(
    PullRequestReviewer,
    Effect.gen(function* () {
      const provide = yield* captureGitPlatform();
      const read = Effect.fn('PullRequestReviewer.read')(function* <T>(
        target: { account: string; owner: string; repo: string },
        endpoint: string,
        schema: Schema.Codec<T, string>,
      ) {
        const json = yield* readGitHubApi(
          { account: target.account, endpoint },
          limits,
        ).pipe(
          provide,
          access.forgetWhenRefused(target, lacksAccess),
          Effect.mapError(unavailable),
        );
        return yield* Schema.decodeEffect(schema)(json).pipe(
          Effect.mapError(
            () => new GitHubReadError({ reason: 'invalid-response' }),
          ),
        );
      });
      return PullRequestReviewer.of({
        diff: Effect.fn('PullRequestReviewer.diff')(function* (input) {
          const pull = `repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/pulls/${input.number}`;
          const { head } = yield* read(input, pull, pullSchema);
          const files: PullRequestFile[] = [];
          for (let page = 1; page <= MAX_FILE_PAGES; page += 1) {
            const batch = yield* read(
              input,
              `${pull}/files?per_page=${FILES_PER_PAGE}&page=${page}`,
              filesSchema,
            );
            for (const file of batch)
              files.push({ path: file.filename, patch: file.patch });
            if (batch.length < FILES_PER_PAGE) break;
          }
          return { headOid: head.sha, files };
        }),
        post: (input) =>
          postGitHubPullRequestReview(input, limits).pipe(
            provide,
            access.forgetWhenRefused(input, lacksAccess),
            Effect.map((url) => ({ url })),
            Effect.mapError(
              (error) =>
                new PullRequestReviewFailedError({
                  message:
                    error._tag === 'GitHubCommandError' &&
                    (error.reason === 'offline' ||
                      error.reason === 'invalid-response')
                      ? 'GitHub may have received this review. Check the pull request before posting again.'
                      : 'GitHub did not take this review. Check your sign-in and that the pull request is still open, then try again.',
                }),
            ),
          ),
      });
    }),
  );
