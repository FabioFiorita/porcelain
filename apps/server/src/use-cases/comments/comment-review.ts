import { Context, Effect, Layer } from 'effect';
import type { GitIoFailure } from '@porcelain/git/errors';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import { ReadWorktreeStatusService } from '@porcelain/changes/services';
import { ReadTextFileService } from '@porcelain/files/services';
import {
  PullRequestReviewFailedError,
  type ReviewChangedError,
} from '@porcelain/reviews/errors';
import { DraftCommentStore } from '@porcelain/reviews/ports';
import {
  ListDraftCommentsService,
  PreviewPullRequestReviewService,
  PublishPullRequestReviewService,
} from '@porcelain/reviews/services';
import type {
  PublishReviewRequest,
  PublishReviewResponse,
  ReviewPreviewResponse,
} from '@porcelain/contracts/comments';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { readCommentsView } from '../../runtime/read-comments-view.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { ListProjectPullRequestsUseCasePort } from '../../ports/list-project-pull-requests-use-case-port.ts';
import { ResolveProjectGitHubUseCasePort } from '../../ports/resolve-project-github-use-case-port.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';

type Unavailable = Extract<ReviewPreviewResponse, { kind: 'unavailable' }>;
type ReadFailure = WorktreeAccessFailure | GitIoFailure | ProjectNotFoundError;

export class CommentReviewUseCase extends Context.Service<
  CommentReviewUseCase,
  {
    readonly preview: (
      input: WorktreeParams,
    ) => Effect.Effect<ReviewPreviewResponse, ReadFailure>;
    readonly publish: (
      input: WorktreeParams & PublishReviewRequest,
    ) => Effect.Effect<
      PublishReviewResponse,
      ReadFailure | ReviewChangedError | PullRequestReviewFailedError
    >;
  }
>()('@porcelain/server/CommentReviewUseCase') {
  static readonly layer = Layer.effect(
    CommentReviewUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const resolve = yield* ResolveProjectGitHubUseCasePort;
      const pulls = yield* ListProjectPullRequestsUseCasePort;
      const preview = yield* PreviewPullRequestReviewService;
      const publish = yield* PublishPullRequestReviewService;
      const events = yield* EventPublisher;
      const capabilities = {
        status: yield* ReadWorktreeStatusService,
        texts: yield* ReadTextFileService,
        list: yield* ListDraftCommentsService,
        store: yield* DraftCommentStore,
      };
      const readView = (worktreeId: string) =>
        access.reviews(worktreeId, 'read', (worktree) =>
          Effect.map(readCommentsView(capabilities, worktreeId), (view) => ({
            view,
            projectId: worktree.projectId,
          })),
        );
      const target = Effect.fn('CommentReviewUseCase.target')(function* (
        worktreeId: string,
      ) {
        const { view, projectId } = yield* readView(worktreeId);
        const open = view.comments.filter(
          (comment) => comment.publication.status === 'draft',
        );
        const unavailable = (reason: Unavailable['reason']) => ({
          view,
          open,
          found: { kind: 'unavailable' as const, reason },
        });
        if (open.length === 0) return unavailable('no-comments');
        const { repository, selection } = yield* resolve.execute({ projectId });
        if (selection.unavailable)
          return unavailable(selection.unavailable.reason);
        if (!repository || !selection.choice) return unavailable('not-github');
        const listed = yield* pulls.execute({ projectId });
        if (listed.kind !== 'available') return unavailable(listed.reason);
        const pull = listed.pullRequests.find(
          (candidate) =>
            candidate.state === 'open' && candidate.headBranch === view.branch,
        );
        if (!pull) return unavailable('no-pull-request');
        return {
          view,
          open,
          found: {
            kind: 'available' as const,
            pullRequest: {
              number: pull.number,
              url: pull.url,
              title: pull.title,
            },
            target: {
              ...repository,
              account: selection.choice.account,
              number: pull.number,
            },
          },
        };
      });
      return {
        preview: Effect.fn('CommentReviewUseCase.preview')(function* (input) {
          const { open, found } = yield* target(input.worktreeId);
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
        }),
        publish: Effect.fn('CommentReviewUseCase.publish')(function* (input) {
          const { open, found } = yield* target(input.worktreeId);
          if (found.kind === 'unavailable')
            return yield* new PullRequestReviewFailedError({
              message:
                found.reason === 'no-pull-request'
                  ? 'This branch has no open pull request.'
                  : 'GitHub is not available for this project right now.',
            });
          const posted = yield* access.reviews(input.worktreeId, 'write', () =>
            publish
              .execute({
                worktreeId: input.worktreeId,
                target: found.target,
                comments: open,
                confirmed: input,
              })
              .pipe(
                Effect.catchTag('GitHubReadError', () =>
                  Effect.fail(
                    new PullRequestReviewFailedError({
                      message:
                        'GitHub could not be read. Check your connection and try again.',
                    }),
                  ),
                ),
              ),
          );
          yield* events.worktreeChanged({
            worktreeId: input.worktreeId,
            change: 'comments',
          });
          const { view } = yield* readView(input.worktreeId);
          return { url: posted.url, view };
        }),
      };
    }),
  );
}
