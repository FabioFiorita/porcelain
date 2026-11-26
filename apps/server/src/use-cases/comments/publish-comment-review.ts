import { Context, Effect, Layer } from 'effect';
import type { GitIoFailure } from '@porcelain/git/errors';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import { ReadWorktreeStatusService } from '@porcelain/changes/services';
import { ReadTextFileService } from '@porcelain/files/services';
import type {
  PullRequestReviewFailedError,
  ReviewChangedError,
} from '@porcelain/reviews/errors';
import {
  ListCommentedPathsService,
  ListDraftCommentsService,
  PublishPullRequestReviewService,
} from '@porcelain/reviews/services';
import type {
  PublishReviewRequest,
  PublishReviewResponse,
} from '@porcelain/contracts/comments';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { readCommentsView } from '../../runtime/read-comments-view.ts';
import { commentReviewTarget } from '../../runtime/comment-review-target.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { ListProjectPullRequestsUseCasePort } from '../../ports/list-project-pull-requests-use-case-port.ts';
import { ResolveProjectGitHubUseCasePort } from '../../ports/resolve-project-github-use-case-port.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';

export class PublishCommentReviewUseCase extends Context.Service<
  PublishCommentReviewUseCase,
  {
    readonly execute: (
      input: WorktreeParams & PublishReviewRequest,
    ) => Effect.Effect<
      PublishReviewResponse,
      | WorktreeAccessFailure
      | GitIoFailure
      | ProjectNotFoundError
      | ReviewChangedError
      | PullRequestReviewFailedError
    >;
  }
>()('@porcelain/server/PublishCommentReviewUseCase') {
  static readonly layer = Layer.effect(
    PublishCommentReviewUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const publish = yield* PublishPullRequestReviewService;
      const events = yield* EventPublisher;
      const capabilities = {
        status: yield* ReadWorktreeStatusService,
        texts: yield* ReadTextFileService,
        paths: yield* ListCommentedPathsService,
        list: yield* ListDraftCommentsService,
        resolve: yield* ResolveProjectGitHubUseCasePort,
        pulls: yield* ListProjectPullRequestsUseCasePort,
      };
      const readView = (worktreeId: string) =>
        access.reviews(worktreeId, 'read', (worktree) =>
          Effect.map(readCommentsView(capabilities, worktreeId), (view) => ({
            view,
            projectId: worktree.projectId,
          })),
        );
      return {
        execute: Effect.fn('PublishCommentReviewUseCase.execute')(
          function* (input) {
            const { view, projectId } = yield* readView(input.worktreeId);
            const { open, found } = yield* commentReviewTarget(capabilities, {
              projectId,
              branch: view.branch,
              comments: view.comments,
            });
            const posted = yield* access.reviews(
              input.worktreeId,
              'write',
              () =>
                publish.execute({
                  worktreeId: input.worktreeId,
                  target:
                    found.kind === 'available'
                      ? found.target
                      : { unavailable: found.reason },
                  comments: open,
                  confirmed: input,
                }),
            );
            yield* events.worktreeChanged({
              worktreeId: input.worktreeId,
              change: 'comments',
            });
            const after = yield* readView(input.worktreeId);
            return { url: posted.url, view: after.view };
          },
        ),
      };
    }),
  );
}
