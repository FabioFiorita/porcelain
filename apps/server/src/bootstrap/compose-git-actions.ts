import type {
  CommitDraftSource,
  CommitModelReader,
} from '@porcelain/git-actions/ports';
import {
  AcceptGitActionService,
  CaptureCommitDraftService,
  DismissInterruptedGitActionService,
  ExpireGitActionReceiptsService,
  FinishGitActionService,
  GenerateCommitDraftService,
  InterruptGitActionService,
  ListCommitModelsService,
  ListGitBranchesService,
  ReadGitActionReceiptService,
  RecordGitActionProgressService,
  RecoverInterruptedGitActionsService,
  RunGitActionService,
} from '@porcelain/git-actions/services';
import { CheckProjectService } from '@porcelain/projects/services';
import { FilesystemUntrackedFileReader } from '../adapters/git-actions/filesystem-untracked-file-reader.ts';
import { GitGitActionRunner } from '../adapters/git-actions/git-git-action-runner.ts';
import { GitBranchReader } from '../adapters/git-actions/git-branch-reader.ts';
import { GitSelectedDiffReader } from '../adapters/git-actions/git-selected-diff-reader.ts';
import { DismissInterruptedGitActionUseCase } from '../use-cases/git-actions/dismiss-interrupted-git-action.ts';
import { GenerateCommitDraftUseCase } from '../use-cases/git-actions/generate-commit-draft.ts';
import { ListCommitModelsUseCase } from '../use-cases/git-actions/list-commit-models.ts';
import { ListGitBranchesUseCase } from '../use-cases/git-actions/list-git-branches.ts';
import { ReadGitActionReceiptUseCase } from '../use-cases/git-actions/read-git-action-receipt.ts';
import { RecoverInterruptedGitActionsUseCase } from '../use-cases/git-actions/recover-interrupted-git-actions.ts';
import { RunGitActionUseCase } from '../use-cases/git-actions/run-git-action.ts';
import type { ComposeContext } from './compose-context.ts';
import type { Shared } from './compose-shared.ts';
import type { Stores } from './compose-stores.ts';

export type GitActionsDependencies = {
  stores: Stores;
  shared: Shared;
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
  const checkProject = new CheckProjectService(stores.inventory);
  const expireGitActionReceipts = new ExpireGitActionReceiptsService(
    store,
    clock,
    limits.receipts,
  );
  return {
    runGitAction: new RunGitActionUseCase(
      checkProject,
      shared.checkWorktree,
      expireGitActionReceipts,
      new AcceptGitActionService(store, clock),
      shared.readWorktreeStatus,
      shared.readChangeFingerprints,
      new RunGitActionService(
        new GitGitActionRunner(shared.worktreeAccess, shared.actionGit),
      ),
      new RecordGitActionProgressService(store, limits.progress),
      new FinishGitActionService(store, clock),
      shared.readPublishedReview,
      shared.readReviewEvidence,
      shared.recordReviewActivity,
      new InterruptGitActionService(store, clock),
      lanes,
      laneKeys,
      events,
      logger,
      { deadlineMs: limits.deadlineMs },
    ),
    readGitActionReceipt: new ReadGitActionReceiptUseCase(
      new ReadGitActionReceiptService(store),
      lanes,
      laneKeys,
    ),
    dismissInterruptedGitAction: new DismissInterruptedGitActionUseCase(
      new DismissInterruptedGitActionService(store, clock),
      new ReadGitActionReceiptService(store),
      lanes,
      laneKeys,
      events,
    ),
    listGitBranches: new ListGitBranchesUseCase(
      checkProject,
      shared.checkWorktree,
      new ListGitBranchesService(
        new GitBranchReader(shared.worktreeAccess, shared.actionGit),
      ),
      lanes,
      laneKeys,
    ),
    listCommitModels: new ListCommitModelsUseCase(
      new ListCommitModelsService(dependencies.commitModelReader),
      lanes,
      { deadlineMs: limits.processDeadlineMs },
    ),
    generateCommitDraft: new GenerateCommitDraftUseCase(
      checkProject,
      shared.checkWorktree,
      shared.readWorktreeStatus,
      shared.readChangeFingerprints,
      new CaptureCommitDraftService(
        new GitSelectedDiffReader(shared.worktreeAccess, shared.actionGit),
        new FilesystemUntrackedFileReader(shared.fileReader),
        limits.commitDraft,
      ),
      new GenerateCommitDraftService(
        dependencies.commitDraftSource,
        limits.commitGroups,
      ),
      lanes,
      laneKeys,
      { deadlineMs: limits.processDeadlineMs },
    ),
    recoverInterruptedGitActions: new RecoverInterruptedGitActionsUseCase(
      new RecoverInterruptedGitActionsService(store, clock),
      expireGitActionReceipts,
      lanes,
      laneKeys,
    ),
  };
}
