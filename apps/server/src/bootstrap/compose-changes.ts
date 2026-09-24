import {
  CheckCommitService,
  ListCommitsService,
  ReadBranchDetailsService,
  ReadCommitDiffsService,
  ReadCommitFilesService,
} from '@porcelain/changes/services';
import { GitCommitHistoryReader } from '../adapters/changes/git-commit-history-reader.ts';
import { ListCommitsUseCase } from '../use-cases/changes/list-commits.ts';
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

export type ChangesDependencies = {
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
  const commitHistoryReader = new GitCommitHistoryReader(
    shared.worktreeAccess,
    shared.commitGit,
  );
  const readBranchDetails = new ReadBranchDetailsService(
    shared.changeStatusReader,
  );
  const listCommits = new ListCommitsService(commitHistoryReader);
  const readCommitFiles = new ReadCommitFilesService(commitHistoryReader);
  const checkCommit = new CheckCommitService(commitHistoryReader);
  const readCommitDiffs = new ReadCommitDiffsService(commitHistoryReader);
  return {
    readChanges: new ReadChangesUseCase(
      checkWorktree,
      readWorktreeStatus,
      readChangeFingerprints,
      shared.readInterruptedGitAction,
      readEnvironment,
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
      shared.readTextFile,
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
  };
}
