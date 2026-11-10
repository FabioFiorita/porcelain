import { ReadRepositoryOriginService } from '@porcelain/projects/services';
import { gitProjectRepositoryReaderLayer } from '../adapters/projects/git-project-repository-reader.ts';
import { gitWalkthroughHeadReaderLayer } from '../adapters/walkthroughs/git-walkthrough-head-reader.ts';
import { ReadWalkthroughWriterSettingsUseCase } from '../use-cases/walkthroughs/read-walkthrough-writer-settings.ts';
import { SaveDefaultWalkthroughWriterUseCase } from '../use-cases/walkthroughs/save-default-walkthrough-writer.ts';
import type { ghPullRequestReaderLayer } from '../adapters/reviews/gh-pull-request-reader.ts';
import { QueueWalkthroughUseCase } from '../use-cases/walkthroughs/queue-walkthrough.ts';
import { QueueWalkthroughUseCasePort } from '../ports/queue-walkthrough-use-case-port.ts';
import { ListProjectPullRequestsUseCasePort } from '../ports/list-project-pull-requests-use-case-port.ts';
import { ReadInventoryUseCasePort } from '../ports/read-inventory-use-case-port.ts';
import type { ReadInventoryUseCase } from '../use-cases/projects/read-inventory.ts';
import type { ListProjectPullRequestsUseCase } from '../use-cases/reviews/list-project-pull-requests.ts';
import { PollAutomaticWalkthroughsUseCase } from '../use-cases/walkthroughs/poll-automatic-walkthroughs.ts';
import { Context, Effect, Layer } from 'effect';
import { ClusterWorkflowEngine, SingleRunner } from 'effect/cluster';
import { NodeCrypto, NodeServices } from '@effect/platform-node';
import {
  ReadWalkthroughWriterSettingsService,
  SaveDefaultWalkthroughWriterService,
  WriteWalkthroughService,
  BeginWalkthroughService,
  StartWalkthroughService,
  ResolveWalkthroughWriterService,
  ReadWalkthroughService,
  ReadWalkthroughTargetService,
  ReadWalkthroughAssetService,
  ListWalkthroughConversationsService,
  AddWalkthroughMessageService,
  RetryWalkthroughAnswerService,
  SaveWalkthroughMessageService,
  AnswerWalkthroughMessageService,
  PlanWalkthroughPostService,
  PostWalkthroughMessagesService,
} from '@porcelain/walkthroughs/services';
import {
  WalkthroughStore,
  WalkthroughInventoryReader,
} from '@porcelain/walkthroughs/ports';
import {
  BranchRangeReader,
  ChangeStatusReader,
} from '@porcelain/changes/ports';
import { GitHubAccountStore } from '@porcelain/reviews/ports';
import { gitWalkthroughSourceReaderLayer } from '../adapters/walkthroughs/git-walkthrough-source-reader.ts';
import { AnnounceWalkthroughUseCase } from '../use-cases/walkthroughs/announce-walkthrough.ts';
import { AnnounceWalkthroughUseCasePort } from '../ports/announce-walkthrough-use-case-port.ts';
import { IdSource } from '@porcelain/kernel/ports';
import { CheckWorktreeUseCasePort } from '../ports/check-worktree-use-case-port.ts';
import { WorktreeConsistencyProbe } from '../ports/worktree-consistency-probe.ts';
import { Lanes } from '../runtime/lanes.ts';
import { LaneKeys } from '../runtime/lane-keys.ts';
import { WorktreeAccess } from '../runtime/worktree-access.ts';
import { EventPublisher } from '../ports/event-publisher.ts';
import { WalkthroughWorkflow } from '../runtime/walkthrough-workflow.ts';
import {
  cliWalkthroughWriterLayer,
  installedWalkthroughModelReaderLayer,
} from '@porcelain/agents/walkthrough-writing';
import { filesystemTranscriptReaderLayer } from '../adapters/walkthroughs/filesystem-transcript-reader.ts';
import { githubEvidenceReaderLayer } from '../adapters/walkthroughs/github-evidence-reader.ts';
import { StartWalkthroughUseCase } from '../use-cases/walkthroughs/start-walkthrough.ts';
import { ReadWalkthroughUseCase } from '../use-cases/walkthroughs/read-walkthrough.ts';
import { ReadWalkthroughAssetUseCase } from '../use-cases/walkthroughs/read-walkthrough-asset.ts';
import { ListWalkthroughConversationsUseCase } from '../use-cases/walkthroughs/list-walkthrough-conversations.ts';
import { AddWalkthroughMessageUseCase } from '../use-cases/walkthroughs/add-walkthrough-message.ts';
import { RetryWalkthroughAnswerUseCase } from '../use-cases/walkthroughs/retry-walkthrough-answer.ts';
import { SaveWalkthroughMessageUseCase } from '../use-cases/walkthroughs/save-walkthrough-message.ts';
import { PostWalkthroughMessagesUseCase } from '../use-cases/walkthroughs/post-walkthrough-messages.ts';
import { ReadWalkthroughBriefUseCase } from '../use-cases/walkthroughs/read-walkthrough-brief.ts';
import { ResolveProjectGitHubUseCasePort } from '../ports/resolve-project-github-use-case-port.ts';
import { ghPullRequestCommenterLayer } from '../adapters/walkthroughs/gh-pull-request-commenter.ts';
import { walkthroughsRoutes } from '../http/routes/walkthroughs/walkthroughs-api.ts';
import type { ComposeContext } from './compose-context.ts';
import type { Shared } from './compose-shared.ts';
import type { Stores } from './compose-stores.ts';
export function composeWalkthroughs(
  context: ComposeContext,
  shared: Shared,
  stores: Stores,
  checkWorktree: CheckWorktreeUseCasePort,
  inventory: Context.Service.Shape<typeof ReadInventoryUseCase>,
  pulls: Context.Service.Shape<typeof ListProjectPullRequestsUseCase>,
  githubReader: typeof ghPullRequestReaderLayer,
  resolveProjectGitHub: ResolveProjectGitHubUseCasePort,
) {
  const modelReader = installedWalkthroughModelReaderLayer(
    context.settings.limits.agents,
  );
  const ports = Layer.mergeAll(
    modelReader,
    ReadRepositoryOriginService.layer.pipe(
      Layer.provide(
        gitProjectRepositoryReaderLayer(context.settings.limits.git),
      ),
    ),
    gitWalkthroughHeadReaderLayer(context.settings.limits.git).pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.succeed(ChangeStatusReader, shared.changeStatusReader),
          Layer.succeed(BranchRangeReader, shared.branchRangeReader),
        ),
      ),
    ),
    Layer.succeed(WalkthroughStore, stores.walkthroughs),
    Layer.succeed(WalkthroughInventoryReader, stores.walkthroughInventory),
    Layer.succeed(Lanes, context.lanes),
    Layer.succeed(LaneKeys, context.laneKeys),
    WorktreeAccess.layer.pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.succeed(CheckWorktreeUseCasePort, checkWorktree),
          Layer.succeed(WorktreeConsistencyProbe, shared.confirmWorktree),
          Layer.succeed(Lanes, context.lanes),
          Layer.succeed(LaneKeys, context.laneKeys),
        ),
      ),
    ),
    Layer.succeed(BranchRangeReader, shared.branchRangeReader),
    Layer.succeed(ChangeStatusReader, shared.changeStatusReader),
    Layer.succeed(EventPublisher, context.events),
    Layer.succeed(ResolveProjectGitHubUseCasePort, resolveProjectGitHub),
    ghPullRequestCommenterLayer(context.settings.limits.git),
    Layer.succeed(IdSource, context.ids),
    gitWalkthroughSourceReaderLayer(context.settings.limits.git).pipe(
      Layer.provide(Layer.succeed(BranchRangeReader, shared.branchRangeReader)),
    ),
    AnnounceWalkthroughUseCase.layer.pipe(
      Layer.provide(Layer.succeed(EventPublisher, context.events)),
      Layer.provideMerge(Layer.empty),
    ),
    filesystemTranscriptReaderLayer(),
    cliWalkthroughWriterLayer({
      processGroup: context.settings.limits.agents.processGroup,
    }).pipe(Layer.provide(modelReader)),
    githubEvidenceReaderLayer(context.settings.limits.git).pipe(
      Layer.provide(
        Layer.mergeAll(
          githubReader(context.settings.limits.git),
          Layer.succeed(GitHubAccountStore, stores.githubAccounts),
        ),
      ),
    ),
  ).pipe(Layer.provide(NodeServices.layer));
  const services = Layer.mergeAll(
    ReadWalkthroughWriterSettingsService.layer,
    SaveDefaultWalkthroughWriterService.layer,
    BeginWalkthroughService.layer,
    WriteWalkthroughService.layer,
    StartWalkthroughService.layer.pipe(
      Layer.provide(ResolveWalkthroughWriterService.layer),
    ),
    ReadWalkthroughAssetService.layer,
    ListWalkthroughConversationsService.layer,
    AddWalkthroughMessageService.layer,
    RetryWalkthroughAnswerService.layer,
    SaveWalkthroughMessageService.layer,
    AnswerWalkthroughMessageService.layer.pipe(
      Layer.provide(ResolveWalkthroughWriterService.layer),
    ),
    PostWalkthroughMessagesService.layer.pipe(
      Layer.provideMerge(PlanWalkthroughPostService.layer),
    ),
    Layer.effect(AnnounceWalkthroughUseCasePort, AnnounceWalkthroughUseCase),
  ).pipe(
    Layer.provideMerge(ReadWalkthroughService.layer),
    Layer.provideMerge(ReadWalkthroughTargetService.layer),
    Layer.provideMerge(ports),
  );
  const engine = ClusterWorkflowEngine.layer.pipe(
    Layer.provideMerge(SingleRunner.layer({ runnerStorage: 'memory' })),
    Layer.provide(NodeCrypto.layerDigest),
    Layer.orDie,
  );
  const workflow = WalkthroughWorkflow.layer.pipe(
    Layer.provideMerge(services),
    Layer.provideMerge(engine),
  );
  const operations = Layer.mergeAll(
    ReadWalkthroughWriterSettingsUseCase.layer,
    SaveDefaultWalkthroughWriterUseCase.layer,
    QueueWalkthroughUseCase.layer,
    ReadWalkthroughUseCase.layer,
    ReadWalkthroughAssetUseCase.layer,
    ListWalkthroughConversationsUseCase.layer,
    AddWalkthroughMessageUseCase.layer,
    RetryWalkthroughAnswerUseCase.layer,
    SaveWalkthroughMessageUseCase.layer,
    PostWalkthroughMessagesUseCase.layer,
    ReadWalkthroughBriefUseCase.layer,
  ).pipe(Layer.provideMerge(workflow));
  const queued = Layer.effect(
    QueueWalkthroughUseCasePort,
    QueueWalkthroughUseCase,
  ).pipe(Layer.provideMerge(operations));
  const starts = StartWalkthroughUseCase.layer.pipe(Layer.provideMerge(queued));
  return Effect.gen(function* () {
    const runtime = yield* Layer.build(
      PollAutomaticWalkthroughsUseCase.layer.pipe(
        Layer.provideMerge(starts),
        Layer.provide(
          Layer.mergeAll(
            Layer.succeed(ReadInventoryUseCasePort, inventory),
            Layer.succeed(ListProjectPullRequestsUseCasePort, pulls),
          ),
        ),
      ),
    );
    const useCases = {
      writerSettings: Context.get(
        runtime,
        ReadWalkthroughWriterSettingsUseCase,
      ),
      saveDefaultWriter: Context.get(
        runtime,
        SaveDefaultWalkthroughWriterUseCase,
      ),
      start: Context.get(runtime, StartWalkthroughUseCase),
      read: Context.get(runtime, ReadWalkthroughUseCase),
      asset: Context.get(runtime, ReadWalkthroughAssetUseCase),
      conversations: Context.get(runtime, ListWalkthroughConversationsUseCase),
      addMessage: Context.get(runtime, AddWalkthroughMessageUseCase),
      retryAnswer: Context.get(runtime, RetryWalkthroughAnswerUseCase),
      saveMessage: Context.get(runtime, SaveWalkthroughMessageUseCase),
      postMessages: Context.get(runtime, PostWalkthroughMessagesUseCase),
      brief: Context.get(runtime, ReadWalkthroughBriefUseCase),
    };
    return {
      poll: Context.get(runtime, PollAutomaticWalkthroughsUseCase),
      routes: walkthroughsRoutes(useCases),
      workflow: Context.get(runtime, WalkthroughWorkflow),
    };
  });
}
