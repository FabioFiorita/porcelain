import type { ReadEnvironmentService } from '@porcelain/access/services';
import {
  CheckCommitService,
  ListCommitsService,
  ReadBranchDetailsService,
  ReadChangeDiffsService,
  ReadChangeFingerprintsService,
  ReadCommitDiffsService,
  ReadCommitFilesService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import type { ReadTextFileService } from '@porcelain/files/services';
import type { ReadInterruptedGitActionService } from '@porcelain/git-actions/services';
import type { ListedWorktree } from '@porcelain/projects/models';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type { WorktreeAccessReader } from '@porcelain/kernel/ports';
import type { ReconcileReviewedFilesService } from '@porcelain/reviews/services';
import type { CommitReaderFactory } from '@porcelain/git/history';
import type { InspectionFactory } from '@porcelain/git/inspection';
import { GitChangeDiffReader } from '../adapters/changes/git-change-diff-reader.ts';
import { GitChangeStatusReader } from '../adapters/changes/git-change-status-reader.ts';
import { GitCommitHistoryReader } from '../adapters/changes/git-commit-history-reader.ts';
import { GitWorktreeSideReader } from '../adapters/changes/git-worktree-side-reader.ts';
import { inspectionCheckouts } from '../adapters/changes/inspection-checkouts.ts';
import { ListCommitsUseCase } from '../use-cases/changes/list-commits.ts';
import { ReadChangeDiffsUseCase } from '../use-cases/changes/read-change-diffs.ts';
import { ReadChangeLinesUseCase } from '../use-cases/changes/read-change-lines.ts';
import { ReadChangesUseCase } from '../use-cases/changes/read-changes.ts';
import { ReadCommitDiffsUseCase } from '../use-cases/changes/read-commit-diffs.ts';
import { ReadCommitFilesUseCase } from '../use-cases/changes/read-commit-files.ts';
import { ReadGitStatusUseCase } from '../use-cases/changes/read-git-status.ts';
import { SharedReads } from '../runtime/shared-reads.ts';
import type { ComposeContext } from './compose-context.ts';

export type ChangesAdapters = {
  worktreeAccess: WorktreeAccessReader<ListedWorktree>;
  checkWorktree: CheckWorktreeService;
  readEnvironment: ReadEnvironmentService;
  inspection: InspectionFactory;
  commitGit: CommitReaderFactory;
  readTextFile: ReadTextFileService;
  reconcileReviewedFiles: ReconcileReviewedFilesService;
  readInterruptedGitAction: ReadInterruptedGitActionService;
};

export function composeChanges(
  context: ComposeContext,
  adapters: ChangesAdapters,
) {
  const { lanes, laneKeys } = context;
  const limits = context.settings.limits.changes;
  const openInspection = inspectionCheckouts(
    adapters.worktreeAccess,
    adapters.inspection,
  );
  const changeStatusReader = new GitChangeStatusReader(openInspection);
  const worktreeSideReader = new GitWorktreeSideReader(
    openInspection,
    limits.worktreeReads,
  );
  const changeDiffReader = new GitChangeDiffReader(openInspection);
  const commitHistoryReader = new GitCommitHistoryReader(
    adapters.worktreeAccess,
    adapters.commitGit,
  );
  const { checkWorktree, readEnvironment } = adapters;
  const readWorktreeStatus = new ReadWorktreeStatusService(changeStatusReader);
  const readBranchDetails = new ReadBranchDetailsService(changeStatusReader);
  const readChangeFingerprints = new ReadChangeFingerprintsService(
    worktreeSideReader,
    limits.fingerprints,
  );
  const readChangeDiffs = new ReadChangeDiffsService(changeDiffReader);
  const listCommits = new ListCommitsService(commitHistoryReader);
  const readCommitFiles = new ReadCommitFilesService(commitHistoryReader);
  const checkCommit = new CheckCommitService(commitHistoryReader);
  const readCommitDiffs = new ReadCommitDiffsService(commitHistoryReader);
  return {
    readChanges: new ReadChangesUseCase(
      checkWorktree,
      readWorktreeStatus,
      readChangeFingerprints,
      adapters.readInterruptedGitAction,
      readEnvironment,
      adapters.reconcileReviewedFiles,
      lanes,
      laneKeys,
    ),
    readChangeDiffs: new ReadChangeDiffsUseCase(
      checkWorktree,
      readWorktreeStatus,
      readChangeFingerprints,
      readChangeDiffs,
      readEnvironment,
      lanes,
      laneKeys,
    ),
    readChangeLines: new ReadChangeLinesUseCase(
      checkWorktree,
      adapters.readTextFile,
      readEnvironment,
      lanes,
      laneKeys,
      limits.changeLines,
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
      readChangeDiffs,
    },
  };
}
