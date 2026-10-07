import { FindProjectService } from '@porcelain/projects/services';
import { InventoryStore } from '@porcelain/projects/ports';
import { GenerateCommitDraftUseCaseOptions } from '../ports/generate-commit-draft-use-case-options.ts';
import { ListCommitModelsUseCaseOptions } from '../ports/list-commit-models-use-case-options.ts';
import { RunGitActionUseCaseOptions } from '../ports/run-git-action-use-case-options.ts';
import { Logger } from '../ports/logger.ts';
import { EventPublisher } from '../ports/event-publisher.ts';
import { LaneKeys } from '../runtime/lane-keys.ts';
import { Lanes } from '../runtime/lanes.ts';
import { WorktreeConsistencyProbe } from '../ports/worktree-consistency-probe.ts';
import { Effect, Layer, Clock } from 'effect';
import { ClusterWorkflowEngine, SingleRunner } from 'effect/cluster';
import { GitActionWorkflow } from '../runtime/git-action-workflow.ts';
import { WorktreeAccess } from '../runtime/worktree-access.ts';
import { gitActionsRoutes } from '../http/routes/git-actions/git-actions-api.ts';
import {
  ConfirmDiffObservationService,
  ReadWorktreeStatusService,
  ReadChangeFingerprintsService,
} from '@porcelain/changes/services';
import {
  CommitDraftSource,
  CommitModelReader,
  GitActionReceiptStore,
  ExpireGitActionReceiptsOptions,
  RecordGitActionProgressOptions,
  UntrackedFileReader,
  CaptureCommitDraftOptions,
  GenerateCommitDraftOptions,
} from '@porcelain/git-actions/ports';
import {
  AcceptGitActionService,
  BeginGitActionService,
  CaptureCommitDraftService,
  DismissInterruptedGitActionService,
  ExpireGitActionReceiptsService,
  FinishGitActionService,
  GenerateCommitDraftService,
  InterruptGitActionService,
  ListCommitModelsService,
  ReadGitActionReceiptService,
  ReadQueuedGitActionService,
  RecordGitActionProgressService,
  RunGitActionService,
} from '@porcelain/git-actions/services';
import { FilesystemUntrackedFileReader } from '../adapters/git-actions/filesystem-untracked-file-reader.ts';
import { gitGitActionRunnerLayer } from '../adapters/git-actions/git-git-action-runner.ts';
import { gitSelectedDiffReaderLayer } from '../adapters/git-actions/git-selected-diff-reader.ts';
import { DismissInterruptedGitActionUseCase } from '../use-cases/git-actions/dismiss-interrupted-git-action.ts';
import { GenerateCommitDraftUseCase } from '../use-cases/git-actions/generate-commit-draft.ts';
import { ListCommitModelsUseCase } from '../use-cases/git-actions/list-commit-models.ts';
import { ReadGitActionReceiptUseCase } from '../use-cases/git-actions/read-git-action-receipt.ts';
import { RunGitActionUseCase } from '../use-cases/git-actions/run-git-action.ts';
import { RunQueuedGitActionUseCase } from '../use-cases/git-actions/run-queued-git-action.ts';
import { RunQueuedGitActionUseCasePort } from '../ports/run-queued-git-action-use-case-port.ts';
import { CheckWorktreeUseCasePort } from '../ports/check-worktree-use-case-port.ts';
import { RefreshWorktreeReviewUseCasePort } from '../ports/refresh-worktree-review-use-case-port.ts';
import { type ComposeContext } from './compose-context.ts';
import { type Shared } from './compose-shared.ts';
import { type Stores } from './compose-stores.ts';

type GitActionsDependencies = {
  stores: Stores;
  shared: Shared;
  checkWorktree: CheckWorktreeUseCasePort;
  refreshWorktreeReview: RefreshWorktreeReviewUseCasePort;
  commitDraftSource: CommitDraftSource;
  commitModelReader: CommitModelReader;
};

export function composeGitActions(
  context: ComposeContext,
  dependencies: GitActionsDependencies,
) {
  const { lanes, laneKeys, events, clock, logger } = context;
  const limits = context.settings.limits.gitActions;
  const { stores, shared } = dependencies;
  const store = stores.gitActions;
  const ports = Layer.mergeAll(
    Layer.succeed(GitActionReceiptStore, store),
    Layer.succeed(Clock.Clock, clock),
    Layer.succeed(ExpireGitActionReceiptsOptions, limits.receipts),
    Layer.succeed(CheckWorktreeUseCasePort, dependencies.checkWorktree),
    Layer.succeed(WorktreeConsistencyProbe, shared.confirmWorktree),
    Layer.succeed(Lanes, lanes),
    Layer.succeed(LaneKeys, laneKeys),
    Layer.succeed(ReadWorktreeStatusService, shared.readWorktreeStatus),
    Layer.succeed(ReadChangeFingerprintsService, shared.readChangeFingerprints),
    gitGitActionRunnerLayer(shared.worktreeAccess, context.settings.limits.git),
    Layer.succeed(RecordGitActionProgressOptions, limits.progress),
    Layer.succeed(
      RefreshWorktreeReviewUseCasePort,
      dependencies.refreshWorktreeReview,
    ),
    Layer.succeed(EventPublisher, events),
    Layer.succeed(Logger, logger),
    Layer.succeed(RunGitActionUseCaseOptions, {
      deadlineMs: limits.deadlineMs,
    }),
    Layer.succeed(CommitModelReader, dependencies.commitModelReader),
    Layer.succeed(ListCommitModelsUseCaseOptions, {
      deadlineMs: limits.processDeadlineMs,
    }),
    gitSelectedDiffReaderLayer(
      shared.worktreeAccess,
      context.settings.limits.git,
    ),
    Layer.succeed(
      UntrackedFileReader,
      new FilesystemUntrackedFileReader(shared.fileReader),
    ),
    Layer.succeed(CaptureCommitDraftOptions, limits.commitDraft),
    Layer.succeed(CommitDraftSource, dependencies.commitDraftSource),
    Layer.succeed(GenerateCommitDraftOptions, limits.commitGroups),
    Layer.succeed(GenerateCommitDraftUseCaseOptions, {
      deadlineMs: limits.processDeadlineMs,
    }),
    Layer.succeed(InventoryStore, stores.inventory),
  );
  const services = Layer.mergeAll(
    FindProjectService.layer,
    ExpireGitActionReceiptsService.layer,
    WorktreeAccess.layer,
    AcceptGitActionService.layer,
    RunGitActionService.layer,
    RecordGitActionProgressService.layer,
    FinishGitActionService.layer,
    InterruptGitActionService.layer,
    ReadGitActionReceiptService.layer,
    ReadQueuedGitActionService.layer,
    DismissInterruptedGitActionService.layer,
    ListCommitModelsService.layer,
    ConfirmDiffObservationService.layer,
    CaptureCommitDraftService.layer,
    GenerateCommitDraftService.layer,
  ).pipe(Layer.provideMerge(ports));
  const queued = Layer.effect(
    RunQueuedGitActionUseCasePort,
    RunQueuedGitActionUseCase,
  ).pipe(
    Layer.provideMerge(
      RunQueuedGitActionUseCase.layer.pipe(
        Layer.provideMerge(
          BeginGitActionService.layer.pipe(Layer.provideMerge(services)),
        ),
      ),
    ),
  );
  const engine = ClusterWorkflowEngine.layer.pipe(
    Layer.provideMerge(SingleRunner.layer({ runnerStorage: 'memory' })),
    Layer.orDie,
  );
  const workflow = GitActionWorkflow.layer.pipe(
    Layer.provideMerge(queued),
    Layer.provideMerge(engine),
  );
  const operations = Layer.mergeAll(
    RunGitActionUseCase.layer,
    ReadGitActionReceiptUseCase.layer,
    DismissInterruptedGitActionUseCase.layer,
    ListCommitModelsUseCase.layer,
    GenerateCommitDraftUseCase.layer,
  ).pipe(Layer.provideMerge(workflow));
  return Effect.gen(function* () {
    const runtime = yield* Layer.build(operations);
    return yield* Effect.gen(function* () {
      const useCases = {
        runGitAction: yield* RunGitActionUseCase,
        readGitActionReceipt: yield* ReadGitActionReceiptUseCase,
        dismissInterruptedGitAction: yield* DismissInterruptedGitActionUseCase,
        listCommitModels: yield* ListCommitModelsUseCase,
        generateCommitDraft: yield* GenerateCommitDraftUseCase,
      };
      return {
        ...useCases,
        gitActionWorkflow: yield* GitActionWorkflow,
        routes: gitActionsRoutes(useCases),
      };
    }).pipe(Effect.provideContext(runtime));
  });
}
