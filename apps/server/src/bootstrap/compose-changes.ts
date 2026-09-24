import { ReadEnvironmentService } from '@porcelain/access/services';
import {
  CheckCommitService,
  ConfirmDiffObservationService,
  ListCommitsService,
  ReadBranchDetailsService,
  ReadChangeDiffsService,
  ReadChangeFingerprintsService,
  ReadChangeLinesService,
  ReadCommitDiffsService,
  ReadCommitFilesService,
  ReadHeadTextService,
  ReadWorktreeStatusService,
  SelectDiffComparisonsService,
} from '@porcelain/changes/services';
import type { ReadTextFileService } from '@porcelain/files/services';
import type { ReadInterruptedGitActionService } from '@porcelain/git-actions/services';
import type { ListedWorktree } from '@porcelain/projects/models';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type { WorktreeAccess } from '@porcelain/kernel/ports';
import type { ReconcileReviewedFilesService } from '@porcelain/reviews/services';
import type { CommitReaderFactory } from '@porcelain/git/history';
import type { InspectionFactory } from '@porcelain/git/inspection';
import type { StorageSession } from '@porcelain/storage';
import { createEnvironmentIdentityStore } from '@porcelain/storage/access';
import { GitChangeDiffReader } from '../adapters/changes/git-change-diff-reader.ts';
import { GitChangeStatusReader } from '../adapters/changes/git-change-status-reader.ts';
import { GitCommitHistoryReader } from '../adapters/changes/git-commit-history-reader.ts';
import { GitHeadTextReader } from '../adapters/changes/git-head-text-reader.ts';
import { GitWorktreeSideReader } from '../adapters/changes/git-worktree-side-reader.ts';
import { inspectionCheckouts } from '../adapters/changes/inspection-checkouts.ts';
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

const limits = {
  changeLines: { maxLines: 2000 },
  fingerprints: { maxDigestBytes: 64 * 1024 * 1024 },
};

export function composeChanges(deps: {
  session: StorageSession;
  lanes: Lanes;
  laneKeys: LaneKeys;
  worktreeAccess: WorktreeAccess<ListedWorktree>;
  checkWorktree: CheckWorktreeService;
  inventory: { read(): { environmentId: string } };
  inspection: InspectionFactory;
  commitGit: CommitReaderFactory;
  readTextFile: ReadTextFileService;
  reconcileReviewedFiles: ReconcileReviewedFilesService;
  readInterruptedGitAction: ReadInterruptedGitActionService;
}) {
  const { lanes, laneKeys } = deps;
  const openInspection = inspectionCheckouts(
    deps.worktreeAccess,
    deps.inspection,
  );
  const changeStatusReader = new GitChangeStatusReader(openInspection);
  const worktreeSideReader = new GitWorktreeSideReader(openInspection);
  const changeDiffReader = new GitChangeDiffReader(openInspection);
  const headTextReader = new GitHeadTextReader(openInspection);
  const commitHistoryReader = new GitCommitHistoryReader(
    deps.worktreeAccess,
    deps.inventory,
    deps.commitGit,
  );
  const readEnvironment = new ReadEnvironmentService(
    createEnvironmentIdentityStore(deps.session),
  );
  const { checkWorktree } = deps;
  const readWorktreeStatus = new ReadWorktreeStatusService(changeStatusReader);
  const readBranchDetails = new ReadBranchDetailsService(changeStatusReader);
  const readChangeFingerprints = new ReadChangeFingerprintsService(
    worktreeSideReader,
    limits.fingerprints,
  );
  const selectDiffComparisons = new SelectDiffComparisonsService();
  const confirmDiffObservation = new ConfirmDiffObservationService();
  const readChangeDiffs = new ReadChangeDiffsService(changeDiffReader);
  const readHeadText = new ReadHeadTextService(headTextReader);
  const readChangeLines = new ReadChangeLinesService(limits.changeLines);
  const listCommits = new ListCommitsService(commitHistoryReader);
  const readCommitFiles = new ReadCommitFilesService(commitHistoryReader);
  const checkCommit = new CheckCommitService(commitHistoryReader);
  const readCommitDiffs = new ReadCommitDiffsService(commitHistoryReader);
  return {
    readChanges: new ReadChangesUseCase(
      checkWorktree,
      readWorktreeStatus,
      readChangeFingerprints,
      deps.readInterruptedGitAction,
      readEnvironment,
      deps.reconcileReviewedFiles,
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
      readHeadText,
      deps.readTextFile,
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
      checkCommit,
      readCommitDiffs,
      lanes,
      laneKeys,
    ),
    services: {
      readWorktreeStatus,
      readChangeFingerprints,
      selectDiffComparisons,
      confirmDiffObservation,
      readChangeDiffs,
      readEnvironment,
    },
  };
}
