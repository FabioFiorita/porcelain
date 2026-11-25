import { Clock, Context, Effect, Layer } from 'effect';
import { IdSource } from '@porcelain/kernel/ports';
import { ReadWorktreeStatusService } from '@porcelain/changes/services';
import { ReadTextFileService } from '@porcelain/files/services';
import { DraftCommentStore } from '@porcelain/reviews/ports';
import {
  EditDraftCommentService,
  ListCommentedPathsService,
  ListDraftCommentsService,
  PreviewPullRequestReviewService,
  PublishPullRequestReviewService,
  SaveDraftCommentService,
} from '@porcelain/reviews/services';
import { ghPullRequestReviewerLayer } from '../adapters/reviews/gh-pull-request-reviewer.ts';
import { CheckWorktreeUseCasePort } from '../ports/check-worktree-use-case-port.ts';
import { WorktreeConsistencyProbe } from '../ports/worktree-consistency-probe.ts';
import { EventPublisher } from '../ports/event-publisher.ts';
import { ListProjectPullRequestsUseCasePort } from '../ports/list-project-pull-requests-use-case-port.ts';
import { ReadInventoryUseCasePort } from '../ports/read-inventory-use-case-port.ts';
import { ListCommentsUseCasePort } from '../ports/list-comments-use-case-port.ts';
import { ResolveProjectGitHubUseCasePort } from '../ports/resolve-project-github-use-case-port.ts';
import { Lanes } from '../runtime/lanes.ts';
import { LaneKeys } from '../runtime/lane-keys.ts';
import { WorktreeAccess } from '../runtime/worktree-access.ts';
import { ListCommentsUseCase } from '../use-cases/comments/list-comments.ts';
import { ChangeCommentUseCase } from '../use-cases/comments/change-comment.ts';
import { PreviewCommentReviewUseCase } from '../use-cases/comments/preview-comment-review.ts';
import { PublishCommentReviewUseCase } from '../use-cases/comments/publish-comment-review.ts';
import { ReadOwnerCommentsUseCase } from '../use-cases/comments/read-owner-comments.ts';
import {
  commentsRoutes,
  ownerCommentsRoutes,
} from '../http/routes/comments/comments-api.ts';
import type { ComposeContext } from './compose-context.ts';
import type { Shared } from './compose-shared.ts';
import type { Stores } from './compose-stores.ts';

type Dependencies = {
  stores: Stores;
  shared: Shared;
  checkWorktree: CheckWorktreeUseCasePort;
  resolveProjectGitHub: ResolveProjectGitHubUseCasePort;
  listProjectPullRequests: ListProjectPullRequestsUseCasePort;
  readInventory: ReadInventoryUseCasePort;
};

export function composeComments(
  context: ComposeContext,
  dependencies: Dependencies,
) {
  const { stores, shared } = dependencies;
  const ports = Layer.mergeAll(
    ghPullRequestReviewerLayer(context.settings.limits.git),
    Layer.succeed(DraftCommentStore, stores.draftComments),
    Layer.succeed(IdSource, context.ids),
    Layer.succeed(Clock.Clock, context.clock),
    Layer.succeed(EventPublisher, context.events),
    Layer.succeed(Lanes, context.lanes),
    Layer.succeed(LaneKeys, context.laneKeys),
    Layer.succeed(CheckWorktreeUseCasePort, dependencies.checkWorktree),
    Layer.succeed(WorktreeConsistencyProbe, shared.confirmWorktree),
    Layer.succeed(ReadWorktreeStatusService, shared.readWorktreeStatus),
    Layer.succeed(ReadTextFileService, shared.readTextFileService),
    Layer.succeed(
      ResolveProjectGitHubUseCasePort,
      dependencies.resolveProjectGitHub,
    ),
    Layer.succeed(
      ListProjectPullRequestsUseCasePort,
      dependencies.listProjectPullRequests,
    ),
    Layer.succeed(ReadInventoryUseCasePort, dependencies.readInventory),
  );
  const services = Layer.mergeAll(
    WorktreeAccess.layer,
    SaveDraftCommentService.layer,
    EditDraftCommentService.layer,
    ListDraftCommentsService.layer,
    ListCommentedPathsService.layer,
    PreviewPullRequestReviewService.layer,
    PublishPullRequestReviewService.layer,
  ).pipe(Layer.provideMerge(ports));
  const list = ListCommentsUseCase.layer.pipe(Layer.provideMerge(services));
  const application = Layer.mergeAll(
    ChangeCommentUseCase.layer,
    PreviewCommentReviewUseCase.layer,
    PublishCommentReviewUseCase.layer,
    ReadOwnerCommentsUseCase.layer.pipe(
      Layer.provide(Layer.effect(ListCommentsUseCasePort, ListCommentsUseCase)),
    ),
  ).pipe(Layer.provideMerge(list));
  return Effect.gen(function* () {
    const runtime = yield* Layer.build(application);
    const useCases = {
      listComments: Context.get(runtime, ListCommentsUseCase),
      changeComment: Context.get(runtime, ChangeCommentUseCase),
      previewReview: Context.get(runtime, PreviewCommentReviewUseCase),
      publishReview: Context.get(runtime, PublishCommentReviewUseCase),
      readOwnerComments: Context.get(runtime, ReadOwnerCommentsUseCase),
    };
    return {
      routes: commentsRoutes(useCases),
      owner: ownerCommentsRoutes(useCases),
    };
  });
}
