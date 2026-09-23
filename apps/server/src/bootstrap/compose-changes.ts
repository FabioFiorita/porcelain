import { ReadEnvironmentService } from '@porcelain/access/services';
import type {
  ReviewedFileStore,
  WorktreeAccess,
} from '@porcelain/changes/ports';
import {
  ConfirmCommitService,
  ConfirmDiffObservationService,
  ConfirmWorktreeService,
  DescribeWorktreeStateService,
  ListCommitsService,
  ReadBranchDetailsService,
  ReadChangeDiffsService,
  ReadChangeFingerprintsService,
  ReadChangeLinesService,
  ReadCommitDiffsService,
  ReadCommitFilesService,
  ReadWorktreeStatusService,
  ReconcileReviewedFilesService,
  SelectDiffComparisonsService,
} from '@porcelain/changes/services';
import type { FileReader } from '@porcelain/files/ports';
import type { ReadInterruptedGitActionService } from '@porcelain/git-actions/services';
import type { CommitReaderFactory } from '@porcelain/git/history';
import type { InspectionFactory } from '@porcelain/git/inspection';
import type { ResolvedWorktree } from '@porcelain/projects/models';
import type { StorageSession } from '@porcelain/storage';
import { createEnvironmentIdentityStore } from '@porcelain/storage/access';
import { ChangeDiffAdapter } from '../adapters/changes/change-diff-adapter.ts';
import { ChangeLinesAdapter } from '../adapters/changes/change-lines-adapter.ts';
import { ChangeStatusAdapter } from '../adapters/changes/change-status-adapter.ts';
import { CommitHistoryAdapter } from '../adapters/changes/commit-history-adapter.ts';
import { InspectionCheckouts } from '../adapters/changes/inspection-checkouts.ts';
import { OperationGitSessions } from '../adapters/changes/operation-git-sessions.ts';
import { WorktreeSideAdapter } from '../adapters/changes/worktree-side-adapter.ts';
import { ListCommitsController } from '../controllers/list-commits-controller.ts';
import { ReadChangeDiffsController } from '../controllers/read-change-diffs-controller.ts';
import { ReadChangeLinesController } from '../controllers/read-change-lines-controller.ts';
import { ReadChangesController } from '../controllers/read-changes-controller.ts';
import { ReadCommitDiffsController } from '../controllers/read-commit-diffs-controller.ts';
import { ReadCommitFilesController } from '../controllers/read-commit-files-controller.ts';
import { ReadGitStatusController } from '../controllers/read-git-status-controller.ts';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { SharedReads } from '../runtime/shared-reads.ts';

export function composeChanges(deps: {
  session: StorageSession;
  lanes: Lanes;
  laneKeys: LaneKeys;
  sharedReads: SharedReads;
  worktreeAccess: WorktreeAccess;
  reachableWorktrees: {
    reachable(
      worktreeId: string,
      signal?: AbortSignal,
    ): Promise<ResolvedWorktree>;
  };
  inventory: { read(): { environmentId: string } };
  inspection: InspectionFactory;
  commitGit: CommitReaderFactory;
  files: FileReader;
  reviewedFileStore: ReviewedFileStore;
  readInterruptedGitAction: ReadInterruptedGitActionService;
}) {
  const { lanes, laneKeys } = deps;
  const sessions = new OperationGitSessions();
  const checkouts = new InspectionCheckouts(
    deps.reachableWorktrees,
    sessions,
    deps.inspection,
  );
  const changeStatusReader = new ChangeStatusAdapter(checkouts);
  const worktreeSideReader = new WorktreeSideAdapter(checkouts);
  const changeDiffReader = new ChangeDiffAdapter(checkouts);
  const changeLinesReader = new ChangeLinesAdapter(checkouts, deps.files);
  const commitHistoryReader = new CommitHistoryAdapter(
    deps.reachableWorktrees,
    deps.inventory,
    deps.commitGit,
  );
  const readEnvironment = new ReadEnvironmentService(
    createEnvironmentIdentityStore(deps.session),
  );
  const confirmWorktree = new ConfirmWorktreeService(deps.worktreeAccess);
  const readWorktreeStatus = new ReadWorktreeStatusService(changeStatusReader);
  const readBranchDetails = new ReadBranchDetailsService(changeStatusReader);
  const readChangeFingerprints = new ReadChangeFingerprintsService(
    worktreeSideReader,
  );
  const selectDiffComparisons = new SelectDiffComparisonsService();
  const confirmDiffObservation = new ConfirmDiffObservationService();
  const readChangeDiffs = new ReadChangeDiffsService(changeDiffReader);
  const readChangeLines = new ReadChangeLinesService(changeLinesReader);
  const reconcileReviewedFiles = new ReconcileReviewedFilesService(
    deps.reviewedFileStore,
  );
  const describeWorktreeState = new DescribeWorktreeStateService();
  const listCommits = new ListCommitsService(commitHistoryReader);
  const readCommitFiles = new ReadCommitFilesService(commitHistoryReader);
  const confirmCommit = new ConfirmCommitService(commitHistoryReader);
  const readCommitDiffs = new ReadCommitDiffsService(commitHistoryReader);
  return {
    readChangesController: new ReadChangesController(
      confirmWorktree,
      readWorktreeStatus,
      readChangeFingerprints,
      reconcileReviewedFiles,
      deps.readInterruptedGitAction,
      describeWorktreeState,
      readEnvironment,
      lanes,
      laneKeys,
    ),
    readChangeDiffsController: new ReadChangeDiffsController(
      confirmWorktree,
      readWorktreeStatus,
      selectDiffComparisons,
      readChangeFingerprints,
      confirmDiffObservation,
      readChangeDiffs,
      readEnvironment,
      lanes,
      laneKeys,
    ),
    readChangeLinesController: new ReadChangeLinesController(
      confirmWorktree,
      readChangeLines,
      readEnvironment,
      lanes,
      laneKeys,
    ),
    readGitStatusController: new ReadGitStatusController(
      confirmWorktree,
      readWorktreeStatus,
      readBranchDetails,
      readEnvironment,
      lanes,
      laneKeys,
      deps.sharedReads,
    ),
    listCommitsController: new ListCommitsController(
      confirmWorktree,
      listCommits,
      lanes,
      laneKeys,
    ),
    readCommitFilesController: new ReadCommitFilesController(
      confirmWorktree,
      readCommitFiles,
      lanes,
      laneKeys,
    ),
    readCommitDiffsController: new ReadCommitDiffsController(
      confirmWorktree,
      confirmCommit,
      readCommitDiffs,
      lanes,
      laneKeys,
    ),
    services: {
      confirmWorktree,
      readWorktreeStatus,
      readChangeFingerprints,
      selectDiffComparisons,
      confirmDiffObservation,
      readChangeDiffs,
      readEnvironment,
    },
    sessions,
  };
}
