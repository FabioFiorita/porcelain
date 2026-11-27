import { Effect, Layer } from 'effect';
import {
  captureGitPlatform,
  postGitHubIssueComment,
  rerunGitHubActions,
} from '@porcelain/git/discovery';
import { GitHubPullRequestActions } from '@porcelain/reviews/ports';
import { PullRequestActionRefusedError } from '@porcelain/reviews/errors';
import type { Limits } from '../../config/limits.ts';
import { lacksAccess, type GitHubAccessMemo } from './github-access-memo.ts';

const refused = (
  error:
    | { readonly _tag: 'GitHubWriteRefusedError'; readonly detail: string }
    | {
        readonly _tag: 'GitHubCommandError';
        readonly reason: PullRequestActionRefusedError['reason'] | 'not-found';
      },
) =>
  error._tag === 'GitHubWriteRefusedError'
    ? new PullRequestActionRefusedError({
        reason: 'refused',
        detail: error.detail || undefined,
      })
    : new PullRequestActionRefusedError({
        reason:
          error.reason === 'not-found'
            ? 'pull-request-not-found'
            : error.reason,
      });

const refusedRerun = (error: {
  readonly _tag: string;
  readonly reason?: unknown;
}) => error._tag === 'GitHubWriteRefusedError' || lacksAccess(error);

export const ghPullRequestActionsLayer = (
  limits: Limits['git'],
  access: GitHubAccessMemo,
) =>
  Layer.effect(
    GitHubPullRequestActions,
    Effect.gen(function* () {
      const provide = yield* captureGitPlatform();
      return GitHubPullRequestActions.of({
        rerun: (input) =>
          rerunGitHubActions(input, limits).pipe(
            provide,
            access.forgetWhenRefused(input, refusedRerun),
            Effect.mapError(refused),
          ),
        comment: (input) =>
          postGitHubIssueComment(input, limits).pipe(
            provide,
            access.forgetWhenRefused(input, lacksAccess),
            Effect.map((url) => ({ url })),
            Effect.mapError(refused),
          ),
      });
    }),
  );
