import { Context, Effect, Layer } from 'effect';
import type { GitIoFailure } from '@porcelain/git/errors';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import { ReadWorktreeStatusService } from '@porcelain/changes/services';
import { ReadTextFileService } from '@porcelain/files/services';
import {
  ListCommentedPathsService,
  ListDraftCommentsService,
  PreviewPullRequestReviewService,
} from '@porcelain/reviews/services';
import type { ReviewPreviewResponse } from '@porcelain/contracts/comments';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { readCommentsView } from '../../runtime/read-comments-view.ts';
import { commentReviewTarget } from '../../runtime/comment-review-target.ts';
import { ListProjectPullRequestsUseCasePort } from '../../ports/list-project-pull-requests-use-case-port.ts';
import { ResolveProjectGitHubUseCasePort } from '../../ports/resolve-project-github-use-case-port.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';

export class PreviewCommentReviewUseCase extends Context.Service<
  PreviewCommentReviewUseCase,
  {
    readonly execute: (
      input: WorktreeParams,
    ) => Effect.Effect<
      ReviewPreviewResponse,
      WorktreeAccessFailure | GitIoFailure | ProjectNotFoundError
    >;
  }
>()('@porcelain/server/PreviewCommentReviewUseCase') {
  static readonly layer = Layer.effect(
    PreviewCommentReviewUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const preview = yield* PreviewPullRequestReviewService;
      const capabilities = {
        status: yield* ReadWorktreeStatusService,
        texts: yield* ReadTextFileService,
        paths: yield* ListCommentedPathsService,
        list: yield* ListDraftCommentsService,
        resolve: yield* ResolveProjectGitHubUseCasePort,
        pulls: yield* ListProjectPullRequestsUseCasePort,
      };
      return {
        execute: Effect.fn('PreviewCommentReviewUseCase.execute')(
          function* (input) {
            const { view, projectId } = yield* access.reviews(
              input.worktreeId,
              'read',
              (worktree) =>
                Effect.map(
                  readCommentsView(capabilities, input.worktreeId),
                  (read) => ({ view: read, projectId: worktree.projectId }),
                ),
            );
            const { open, found } = yield* commentReviewTarget(capabilities, {
              projectId,
              branch: view.branch,
              comments: view.comments,
            });
            if (found.kind === 'unavailable') return found;
            const plan = yield* preview
              .execute({ target: found.target, comments: open })
              .pipe(Effect.result);
            if (plan._tag === 'Failure')
              return {
                kind: 'unavailable' as const,
                reason: plan.failure.reason,
              };
            return {
              kind: 'available' as const,
              pullRequest: found.pullRequest,
              ...plan.success,
            };
          },
        ),
      };
    }),
  );
}
