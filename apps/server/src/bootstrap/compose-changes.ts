import type { Effect } from 'effect';
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
} from '@porcelain/changes/services';
import { GitCommitHistoryReader } from '../adapters/changes/git-commit-history-reader.ts';
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
import { SharedReads } from '../runtime/shared-reads.ts';
import type { CheckWorktreeUseCasePort } from '../ports/check-worktree-use-case-port.ts';
import type { ComposeContext } from './compose-context.ts';
import type { Shared } from './compose-shared.ts';

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
  const access = new WorktreeAccess(
    checkWorktree,
    shared.confirmWorktree,
    lanes,
    laneKeys,
  );
  const statusReads = new SharedReads<
    Effect.Success<ReturnType<ReadGitStatusUseCase['execute']>>,
    Effect.Error<ReturnType<ReadGitStatusUseCase['execute']>>
  >();
  const {
    readEnvironment,
    readWorktreeStatus,
    readChangeFingerprints,
    readChangeDiffs,
  } = shared;
  const commitHistoryReader = new GitCommitHistoryReader(
    shared.worktreeAccess,
    shared.commitGit,
  );
  const { branchRangeReader } = shared;
  const readBranchDetails = new ReadBranchDetailsService(
    shared.changeStatusReader,
  );
  const listCommits = new ListCommitsService(commitHistoryReader);
  const readCommitFiles = new ReadCommitFilesService(commitHistoryReader);
  const checkCommit = new CheckCommitService(commitHistoryReader);
  const readCommitDiffs = new ReadCommitDiffsService(commitHistoryReader);
  const useCases = {
    statusReads,
    readBranchChanges: new ReadBranchChangesUseCase(
      access,
      shared.readBranchChanges,
    ),
    readBranchDiffs: new ReadBranchDiffsUseCase(
      access,
      new ReadBranchDiffsService(branchRangeReader),
    ),
    listBranchBases: new ListBranchBasesUseCase(
      access,
      new ListBranchBasesService(branchRangeReader),
    ),
    readChanges: new ReadChangesUseCase(
      access,
      readWorktreeStatus,
      readChangeFingerprints,
      shared.readInterruptedGitAction,
      readEnvironment,
    ),
    readChangeDiffs: new ReadChangeDiffsUseCase(
      access,
      readWorktreeStatus,
      readChangeFingerprints,
      new CheckDiffSelectionService(),
      new ConfirmDiffObservationService(),
      readChangeDiffs,
      readEnvironment,
    ),
    readChangeLines: new ReadChangeLinesUseCase(
      access,
      shared.readTextFileService,
      new ReadChangeLinesService(limits.changeLines),
      readEnvironment,
    ),
    readGitStatus: new ReadGitStatusUseCase(
      access,
      readWorktreeStatus,
      readBranchDetails,
      readEnvironment,
      statusReads,
    ),
    listCommits: new ListCommitsUseCase(access, listCommits),
    listFileCommits: new ListFileCommitsUseCase(
      access,
      new ListFileCommitsService(commitHistoryReader),
    ),
    readCommitFiles: new ReadCommitFilesUseCase(access, readCommitFiles),
    readCommitDiffs: new ReadCommitDiffsUseCase(
      access,
      checkCommit,
      readCommitDiffs,
    ),
  };
  return { ...useCases, routes: changesRoutes(useCases) };
}
