import { Context, Effect, Layer } from 'effect';
import { ClusterWorkflowEngine, SingleRunner } from 'effect/cluster';
import { NodeCrypto, NodeServices } from '@effect/platform-node';
import {
  WriteWalkthroughService,
  BeginWalkthroughService,
  StartWalkthroughService,
  ReadWalkthroughService,
  ReadWalkthroughAssetService,
} from '@porcelain/walkthroughs/services';
import { WalkthroughStore } from '@porcelain/walkthroughs/ports';
import {
  BranchRangeReader,
  ChangeStatusReader,
} from '@porcelain/changes/ports';
import { GitHubAccountStore } from '@porcelain/reviews/ports';
import { ReadWorktreeStatusService } from '@porcelain/changes/services';
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
import { cliWalkthroughWriterLayer } from '@porcelain/agents/walkthrough-writing';
import { filesystemTranscriptReaderLayer } from '../adapters/walkthroughs/filesystem-transcript-reader.ts';
import { githubEvidenceReaderLayer } from '../adapters/walkthroughs/github-evidence-reader.ts';
import { ghPullRequestReaderLayer } from '../adapters/reviews/gh-pull-request-reader.ts';
import { StartWalkthroughUseCase } from '../use-cases/walkthroughs/start-walkthrough.ts';
import { ReadWalkthroughUseCase } from '../use-cases/walkthroughs/read-walkthrough.ts';
import { ReadWalkthroughAssetUseCase } from '../use-cases/walkthroughs/read-walkthrough-asset.ts';
import { walkthroughsRoutes } from '../http/routes/walkthroughs/walkthroughs-api.ts';
import type { ComposeContext } from './compose-context.ts';
import type { Shared } from './compose-shared.ts';
import type { Stores } from './compose-stores.ts';
export function composeWalkthroughs(
  context: ComposeContext,
  shared: Shared,
  stores: Stores,
  checkWorktree: CheckWorktreeUseCasePort,
) {
  const ports = Layer.mergeAll(
    Layer.succeed(WalkthroughStore, stores.walkthroughs),
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
    Layer.succeed(IdSource, context.ids),
    Layer.succeed(ReadWorktreeStatusService, shared.readWorktreeStatus),
    gitWalkthroughSourceReaderLayer.pipe(
      Layer.provide(Layer.succeed(BranchRangeReader, shared.branchRangeReader)),
    ),
    AnnounceWalkthroughUseCase.layer.pipe(
      Layer.provide(Layer.succeed(EventPublisher, context.events)),
      Layer.provideMerge(Layer.empty),
    ),
    filesystemTranscriptReaderLayer(),
    cliWalkthroughWriterLayer({
      processGroup: context.settings.limits.agents.processGroup,
    }),
    githubEvidenceReaderLayer(context.settings.limits.git).pipe(
      Layer.provide(
        Layer.mergeAll(
          ghPullRequestReaderLayer(context.settings.limits.git),
          Layer.succeed(GitHubAccountStore, stores.githubAccounts),
        ),
      ),
    ),
  ).pipe(Layer.provide(NodeServices.layer));
  const services = Layer.mergeAll(
    BeginWalkthroughService.layer,
    WriteWalkthroughService.layer,
    StartWalkthroughService.layer,
    ReadWalkthroughService.layer,
    ReadWalkthroughAssetService.layer,
    Layer.effect(AnnounceWalkthroughUseCasePort, AnnounceWalkthroughUseCase),
  ).pipe(Layer.provideMerge(ports));
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
    StartWalkthroughUseCase.layer,
    ReadWalkthroughUseCase.layer,
    ReadWalkthroughAssetUseCase.layer,
  ).pipe(Layer.provideMerge(workflow));
  return Effect.gen(function* () {
    const runtime = yield* Layer.build(operations);
    const useCases = {
      start: Context.get(runtime, StartWalkthroughUseCase),
      read: Context.get(runtime, ReadWalkthroughUseCase),
      asset: Context.get(runtime, ReadWalkthroughAssetUseCase),
    };
    return {
      routes: walkthroughsRoutes(useCases),
      workflow: Context.get(runtime, WalkthroughWorkflow),
    };
  });
}
