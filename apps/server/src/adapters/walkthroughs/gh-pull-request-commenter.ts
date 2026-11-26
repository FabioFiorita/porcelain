import { Effect, Layer } from 'effect';
import {
  captureGitPlatform,
  postGitHubIssueComment,
} from '@porcelain/git/discovery';
import { PullRequestCommenter } from '@porcelain/walkthroughs/ports';
import { WalkthroughPostFailedError } from '@porcelain/walkthroughs/errors';
import type { Limits } from '../../config/limits.ts';
import {
  lacksAccess,
  type GitHubAccessMemo,
} from '../reviews/github-access-memo.ts';

export const ghPullRequestCommenterLayer = (
  limits: Limits['git'],
  access: GitHubAccessMemo,
) =>
  Layer.effect(
    PullRequestCommenter,
    Effect.gen(function* () {
      const provide = yield* captureGitPlatform();
      return PullRequestCommenter.of({
        comment: (input) =>
          postGitHubIssueComment(input, limits).pipe(
            provide,
            access.forgetWhenRefused(input, lacksAccess),
            Effect.map((url) => ({ url })),
            Effect.mapError(
              () =>
                new WalkthroughPostFailedError({
                  message:
                    'GitHub could not take this comment. Check your sign-in and try again.',
                }),
            ),
          ),
      });
    }),
  );
