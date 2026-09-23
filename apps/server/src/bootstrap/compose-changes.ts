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
import type { ReconcileReviewedFilesService } from '@porcelain/reviews/services';
import type { CommitReaderFactory } from '@porcelain/git/history';
import type { InspectionFactory } from '@porcelain/git/inspection';
import type { WorktreeAccess } from '@porcelain/projects/ports';
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
import { SharedReads } from '../runtime/shared-reads.ts';

export function composeChanges(deps: {
  session: StorageSession;
  lanes: Lanes;
  laneKeys: LaneKeys;
  worktreeAccess: WorktreeAccess;
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
  const changeStatusReader = new ChangeStatusAdapter(checkouts);
  const worktreeSideReader = new WorktreeSideAdapter(checkouts);
  const changeDiffReader = new ChangeDiffAdapter(checkouts);
  const changeLinesReader = new ChangeLinesAdapter(
    checkouts,
    deps.readTextFile,
  );
  const commitHistoryReader = new CommitHistoryAdapter(
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
    readChangesController: new ReadChangesController(
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
    readChangeDiffsController: new ReadChangeDiffsController(
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
    readChangeLinesController: new ReadChangeLinesController(
      checkWorktree,
      readChangeLines,
      readEnvironment,
      lanes,
      laneKeys,
    ),
    readGitStatusController: new ReadGitStatusController(
      checkWorktree,
      readWorktreeStatus,
      readBranchDetails,
      readEnvironment,
      lanes,
      laneKeys,
      new SharedReads(),
    ),
    listCommitsController: new ListCommitsController(
      checkWorktree,
      listCommits,
      lanes,
      laneKeys,
    ),
    readCommitFilesController: new ReadCommitFilesController(
      checkWorktree,
      readCommitFiles,
      lanes,
      laneKeys,
    ),
    readCommitDiffsController: new ReadCommitDiffsController(
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
    sessions,
  };
}
