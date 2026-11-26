import { Effect, Layer } from 'effect';
import {
  captureGitPlatform,
  mergeGitHubPullRequest,
} from '@porcelain/git/discovery';
import { GitHubPullRequestMerger } from '@porcelain/reviews/ports';
import { PullRequestMergeRefusedError } from '@porcelain/reviews/errors';
import type { Limits } from '../../config/limits.ts';
import { lacksAccess, type GitHubAccessMemo } from './github-access-memo.ts';

export const ghPullRequestMergerLayer = (
  limits: Limits['git'],
  access: GitHubAccessMemo,
) =>
  Layer.effect(
    GitHubPullRequestMerger,
    Effect.gen(function* () {
      const provide = yield* captureGitPlatform();
      return GitHubPullRequestMerger.of({
        merge: (input) =>
          mergeGitHubPullRequest(input, limits).pipe(
            provide,
            access.forgetWhenRefused(input, lacksAccess),
            Effect.asVoid,
            Effect.mapError((error) =>
              error._tag === 'GitHubMergeRefusedError'
                ? new PullRequestMergeRefusedError({
                    reason: error.reason,
                    detail: error.detail || undefined,
                  })
                : new PullRequestMergeRefusedError({
                    reason:
                      error.reason === 'not-found'
                        ? 'pull-request-not-found'
                        : error.reason,
                  }),
            ),
          ),
      });
    }),
  );
