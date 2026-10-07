import { GitStatusReads } from '../ports/git-status-reads.ts';
import { ReadTextFileService } from '@porcelain/files/services';
import { ReadEnvironmentService } from '@porcelain/access/services';
import { ReadInterruptedGitActionService } from '@porcelain/git-actions/services';
import { LaneKeys } from '../runtime/lane-keys.ts';
import { Lanes } from '../runtime/lanes.ts';
import { WorktreeConsistencyProbe } from '../ports/worktree-consistency-probe.ts';
import {
  ChangeStatusReader,
  BranchRangeReader,
  ReadChangeLinesOptions,
} from '@porcelain/changes/ports';
import type { Context } from 'effect';
import { Effect, Layer } from 'effect';
import { changesRoutes } from '../http/routes/changes/changes-api.ts';
import { WorktreeAccess } from '../runtime/worktree-access.ts';
import {
  CheckCommitService,
  ListBranchBasesService,
  ReadBranchDiffsService,
  CheckDiffSelectionService,
  ConfirmDiffObservationService,
  ReadChangeLinesService,
  ListCommitsService,
  ListFileCommitsService,
  ReadBranchDetailsService,
  ReadCommitDiffsService,
  ReadCommitFilesService,
  ReadBranchChangesService,
  ReadWorktreeStatusService,
  ReadChangeFingerprintsService,
  ReadChangeDiffsService,
} from '@porcelain/changes/services';
import { gitCommitHistoryReaderLayer } from '../adapters/changes/git-commit-history-reader.ts';
import { ListBranchBasesUseCase } from '../use-cases/changes/list-branch-bases.ts';
import { ReadBranchChangesUseCase } from '../use-cases/changes/read-branch-changes.ts';
import { ReadBranchDiffsUseCase } from '../use-cases/changes/read-branch-diffs.ts';
import { ListCommitsUseCase } from '../use-cases/changes/list-commits.ts';
import { ListFileCommitsUseCase } from '../use-cases/changes/list-file-commits.ts';
import { ReadChangeDiffsUseCase } from '../use-cases/changes/read-change-diffs.ts';
import { ReadChangeLinesUseCase } from '../use-cases/changes/read-change-lines.ts';
import { ReadChangesUseCase } from '../use-cases/changes/read-changes.ts';
import { ReadCommitDiffsUseCase } from '../use-cases/changes/read-commit-diffs.ts';
import { ReadCommitFilesUseCase } from '../use-cases/changes/read-commit-files.ts';
import { ReadGitStatusUseCase } from '../use-cases/changes/read-git-status.ts';
import { makeSharedReads } from '../runtime/shared-reads.ts';
import { CheckWorktreeUseCasePort } from '../ports/check-worktree-use-case-port.ts';
import { type ComposeContext } from './compose-context.ts';
import { type Shared } from './compose-shared.ts';

type ChangesDependencies = {
  shared: Shared;
  checkWorktree: CheckWorktreeUseCasePort;
};

export function composeChanges(
  context: ComposeContext,
  dependencies: ChangesDependencies,
) {
  const { lanes, laneKeys } = context;
  const { shared } = dependencies;
  const limits = context.settings.limits.changes;
  const { checkWorktree } = dependencies;
  const {
    readEnvironment,
    readWorktreeStatus,
    readChangeFingerprints,
    readChangeDiffs,
  } = shared;
  const { branchRangeReader } = shared;
  const ports = Layer.mergeAll(
    Layer.succeed(CheckWorktreeUseCasePort, checkWorktree),
    Layer.succeed(WorktreeConsistencyProbe, shared.confirmWorktree),
    Layer.succeed(Lanes, lanes),
    Layer.succeed(LaneKeys, laneKeys),
    Layer.succeed(ChangeStatusReader, shared.changeStatusReader),
    gitCommitHistoryReaderLayer(
      shared.worktreeAccess,
      shared.gitVersion,
      context.settings.limits.git,
    ),
    Layer.succeed(ReadBranchChangesService, shared.readBranchChanges),
    Layer.succeed(BranchRangeReader, branchRangeReader),
    Layer.succeed(ReadWorktreeStatusService, readWorktreeStatus),
    Layer.succeed(ReadChangeFingerprintsService, readChangeFingerprints),
    Layer.succeed(
      ReadInterruptedGitActionService,
      shared.readInterruptedGitAction,
    ),
    Layer.succeed(ReadEnvironmentService, readEnvironment),
    Layer.succeed(ReadChangeDiffsService, readChangeDiffs),
    Layer.succeed(ReadTextFileService, shared.readTextFileService),
    Layer.succeed(ReadChangeLinesOptions, limits.changeLines),
    Layer.effect(
      GitStatusReads,
      makeSharedReads<
        Effect.Success<
          ReturnType<
            Context.Service.Shape<typeof ReadGitStatusUseCase>['execute']
          >
        >,
        Effect.Error<
          ReturnType<
            Context.Service.Shape<typeof ReadGitStatusUseCase>['execute']
          >
        >
      >(),
    ),
  );
  const services = Layer.mergeAll(
    WorktreeAccess.layer,
    ReadBranchDetailsService.layer,
    ListCommitsService.layer,
    ReadCommitFilesService.layer,
    CheckCommitService.layer,
    ReadCommitDiffsService.layer,
    ReadBranchDiffsService.layer,
    ListBranchBasesService.layer,
    CheckDiffSelectionService.layer,
    ConfirmDiffObservationService.layer,
    ReadChangeLinesService.layer,
    ListFileCommitsService.layer,
  ).pipe(Layer.provideMerge(ports));
  const operations = Layer.mergeAll(
    ReadBranchChangesUseCase.layer,
    ReadBranchDiffsUseCase.layer,
    ListBranchBasesUseCase.layer,
    ReadChangesUseCase.layer,
    ReadChangeDiffsUseCase.layer,
    ReadChangeLinesUseCase.layer,
    ReadGitStatusUseCase.layer,
    ListCommitsUseCase.layer,
    ListFileCommitsUseCase.layer,
    ReadCommitFilesUseCase.layer,
    ReadCommitDiffsUseCase.layer,
  ).pipe(Layer.provideMerge(services));
  return Effect.gen(function* () {
    const runtime = yield* Layer.build(operations);
    return yield* Effect.gen(function* () {
      const useCases = {
        readBranchChanges: yield* ReadBranchChangesUseCase,
        readBranchDiffs: yield* ReadBranchDiffsUseCase,
        listBranchBases: yield* ListBranchBasesUseCase,
        readChanges: yield* ReadChangesUseCase,
        readChangeDiffs: yield* ReadChangeDiffsUseCase,
        readChangeLines: yield* ReadChangeLinesUseCase,
        readGitStatus: yield* ReadGitStatusUseCase,
        listCommits: yield* ListCommitsUseCase,
        listFileCommits: yield* ListFileCommitsUseCase,
        readCommitFiles: yield* ReadCommitFilesUseCase,
        readCommitDiffs: yield* ReadCommitDiffsUseCase,
      };
      return { ...useCases, routes: changesRoutes(useCases) };
    }).pipe(Effect.provideContext(runtime));
  });
}
