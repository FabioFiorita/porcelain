import { ReadEnvironmentService } from '@porcelain/access/services';
import {
  ConfirmCommitService,
  ConfirmDiffObservationService,
  CheckWorktreeService,
  DescribeWorktreeStateService,
  ListCommitsService,
  ReadBranchDetailsService,
  ReadChangeDiffsService,
  ReadChangeFingerprintsService,
  ReadChangeLinesService,
  ReadCommitDiffsService,
  ReadCommitFilesService,
  ReadWorktreeStatusService,
  SelectDiffComparisonsService,
} from '@porcelain/changes/services';
import type { ReadTextFileService } from '@porcelain/files/services';
import type { ReadInterruptedGitActionService } from '@porcelain/git-actions/services';
import type { ListedWorktree } from '@porcelain/projects/models';
import type { WorktreeAccess } from '@porcelain/kernel/ports';
import type { ReconcileReviewedFilesService } from '@porcelain/reviews/services';
import type { CommitReaderFactory } from '@porcelain/git/history';
import type { InspectionFactory } from '@porcelain/git/inspection';
import type { StorageSession } from '@porcelain/storage';
import { createEnvironmentIdentityStore } from '@porcelain/storage/access';
import { GitChangeDiffReader } from '../adapters/changes/git-change-diff-reader.ts';
import { GitChangeLinesReader } from '../adapters/changes/git-change-lines-reader.ts';
import { GitChangeStatusReader } from '../adapters/changes/git-change-status-reader.ts';
import { GitCommitHistoryReader } from '../adapters/changes/git-commit-history-reader.ts';
import { InspectionCheckouts } from '../adapters/changes/inspection-checkouts.ts';
import { OperationGitSessions } from '../adapters/changes/operation-git-sessions.ts';
import { GitWorktreeSideReader } from '../adapters/changes/git-worktree-side-reader.ts';
import { ListCommitsUseCase } from '../use-cases/changes/list-commits.ts';
import { ReadChangeDiffsUseCase } from '../use-cases/changes/read-change-diffs.ts';
import { ReadChangeLinesUseCase } from '../use-cases/changes/read-change-lines.ts';
import { ReadChangesUseCase } from '../use-cases/changes/read-changes.ts';
import { ReadCommitDiffsUseCase } from '../use-cases/changes/read-commit-diffs.ts';
import { ReadCommitFilesUseCase } from '../use-cases/changes/read-commit-files.ts';
import { ReadGitStatusUseCase } from '../use-cases/changes/read-git-status.ts';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import { SharedReads } from '../runtime/shared-reads.ts';

export function composeChanges(deps: {
  session: StorageSession;
  lanes: Lanes;
  laneKeys: LaneKeys;
  worktreeAccess: WorktreeAccess<ListedWorktree>;
  inventory: { read(): { environmentId: string } };
  inspection: InspectionFactory;
  commitGit: CommitReaderFactory;
  readTextFile: ReadTextFileService;
  reconcileReviewedFiles: ReconcileReviewedFilesService;
  readInterruptedGitAction: ReadInterruptedGitActionService;
}) {
  const { lanes, laneKeys } = deps;
  const sessions = new OperationGitSessions();
  const checkouts = new InspectionCheckouts(
    deps.worktreeAccess,
    sessions,
    deps.inspection,
  );
  const changeStatusReader = new GitChangeStatusReader(checkouts);
  const worktreeSideReader = new GitWorktreeSideReader(checkouts);
  const changeDiffReader = new GitChangeDiffReader(checkouts);
  const changeLinesReader = new GitChangeLinesReader(
    checkouts,
    deps.readTextFile,
  );
  const commitHistoryReader = new GitCommitHistoryReader(
    deps.worktreeAccess,
    deps.inventory,
    deps.commitGit,
  );
  const readEnvironment = new ReadEnvironmentService(
    createEnvironmentIdentityStore(deps.session),
  );
  const checkWorktree = new CheckWorktreeService(deps.worktreeAccess);
  const readWorktreeStatus = new ReadWorktreeStatusService(changeStatusReader);
  const readBranchDetails = new ReadBranchDetailsService(changeStatusReader);
  const readChangeFingerprints = new ReadChangeFingerprintsService(
    worktreeSideReader,
  );
  const selectDiffComparisons = new SelectDiffComparisonsService();
  const confirmDiffObservation = new ConfirmDiffObservationService();
  const readChangeDiffs = new ReadChangeDiffsService(changeDiffReader);
  const readChangeLines = new ReadChangeLinesService(changeLinesReader);
  const describeWorktreeState = new DescribeWorktreeStateService();
  const listCommits = new ListCommitsService(commitHistoryReader);
  const readCommitFiles = new ReadCommitFilesService(commitHistoryReader);
  const confirmCommit = new ConfirmCommitService(commitHistoryReader);
  const readCommitDiffs = new ReadCommitDiffsService(commitHistoryReader);
  return {
    readChanges: new ReadChangesUseCase(
      checkWorktree,
      readWorktreeStatus,
      readChangeFingerprints,
      deps.reconcileReviewedFiles,
      deps.readInterruptedGitAction,
      describeWorktreeState,
      readEnvironment,
      lanes,
      laneKeys,
    ),
    readChangeDiffs: new ReadChangeDiffsUseCase(
      checkWorktree,
      readWorktreeStatus,
      selectDiffComparisons,
      readChangeFingerprints,
      confirmDiffObservation,
      readChangeDiffs,
      readEnvironment,
      lanes,
      laneKeys,
    ),
    readChangeLines: new ReadChangeLinesUseCase(
      checkWorktree,
      readChangeLines,
      readEnvironment,
      lanes,
      laneKeys,
    ),
    readGitStatus: new ReadGitStatusUseCase(
      checkWorktree,
      readWorktreeStatus,
      readBranchDetails,
      readEnvironment,
      lanes,
      laneKeys,
      new SharedReads(),
    ),
    listCommits: new ListCommitsUseCase(
      checkWorktree,
      listCommits,
      lanes,
      laneKeys,
    ),
    readCommitFiles: new ReadCommitFilesUseCase(
      checkWorktree,
      readCommitFiles,
      lanes,
      laneKeys,
    ),
    readCommitDiffs: new ReadCommitDiffsUseCase(
      checkWorktree,
      confirmCommit,
      readCommitDiffs,
      lanes,
      laneKeys,
    ),
    services: {
      checkWorktree,
      readWorktreeStatus,
      readChangeFingerprints,
      selectDiffComparisons,
      confirmDiffObservation,
      readChangeDiffs,
      readEnvironment,
    },
  };
}
