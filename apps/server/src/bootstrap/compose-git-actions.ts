import type { FileReader } from '@porcelain/files/ports';
import type { ReadTextFileService } from '@porcelain/files/services';
import type {
  CommitDraftSource,
  CommitModelReader,
} from '@porcelain/git-actions/ports';
import {
  AcceptGitActionService,
  CaptureCommitDraftService,
  CheckGitActionScopeService,
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
import type { GitActionWriterFactory } from '@porcelain/git/actions';
import type { WorktreeAccessReader } from '@porcelain/kernel/ports';
import type { ListedWorktree } from '@porcelain/projects/models';
import type { InventoryStore } from '@porcelain/projects/ports';
import {
  CheckProjectService,
  type CheckWorktreeService,
} from '@porcelain/projects/services';
import { createGitActionStore } from '@porcelain/storage/git-actions';
import { FilesystemUntrackedFileReader } from '../adapters/git-actions/filesystem-untracked-file-reader.ts';
import { GitGitActionRunner } from '../adapters/git-actions/git-git-action-runner.ts';
import { GitGitBranchReader } from '../adapters/git-actions/git-git-branch-reader.ts';
import { GitSelectedDiffReader } from '../adapters/git-actions/git-selected-diff-reader.ts';
import { DismissInterruptedGitActionUseCase } from '../use-cases/git-actions/dismiss-interrupted-git-action.ts';
import { GenerateCommitDraftUseCase } from '../use-cases/git-actions/generate-commit-draft.ts';
import { ListCommitModelsUseCase } from '../use-cases/git-actions/list-commit-models.ts';
import { ListGitBranchesUseCase } from '../use-cases/git-actions/list-git-branches.ts';
import { ReadGitActionReceiptUseCase } from '../use-cases/git-actions/read-git-action-receipt.ts';
import { RecoverInterruptedGitActionsUseCase } from '../use-cases/git-actions/recover-interrupted-git-actions.ts';
import { RunGitActionUseCase } from '../use-cases/git-actions/run-git-action.ts';
import type { composeChanges } from './compose-changes.ts';
import type { composeReviews } from './compose-reviews.ts';
import type { ComposeContext } from './compose-context.ts';

type ChangesServices = ReturnType<typeof composeChanges>['services'];
type ReviewsServices = ReturnType<typeof composeReviews>['services'];

export type GitActionsAdapters = {
  worktreeAccess: WorktreeAccessReader<ListedWorktree>;
  checkWorktree: CheckWorktreeService;
  inventoryStore: InventoryStore;
  actionGit: GitActionWriterFactory;
  fileReader: Pick<FileReader, 'readText'>;
  changes: ChangesServices;
  readTextFile: ReadTextFileService;
  reviews: ReviewsServices;
  commitDraftSource: CommitDraftSource;
  commitModelReader: CommitModelReader;
};

export function composeGitActions(
  context: ComposeContext,
  adapters: GitActionsAdapters,
) {
  const { session, lanes, laneKeys, events, clock } = context;
  const limits = context.settings.limits.gitActions;
  const store = createGitActionStore(session);
  const checkProject = new CheckProjectService(adapters.inventoryStore);
  const checkGitActionScope = new CheckGitActionScopeService();
  const expireGitActionReceipts = new ExpireGitActionReceiptsService(
    store,
    clock,
    limits.receipts,
  );
  return {
    runGitAction: new RunGitActionUseCase(
      checkProject,
      adapters.checkWorktree,
      checkGitActionScope,
      expireGitActionReceipts,
      new AcceptGitActionService(store, clock),
      adapters.changes.readWorktreeStatus,
      adapters.changes.readChangeFingerprints,
      new RunGitActionService(
        new GitGitActionRunner(adapters.worktreeAccess, adapters.actionGit),
      ),
      new RecordGitActionProgressService(store, limits.progress),
      new FinishGitActionService(store, clock),
      adapters.reviews.readPublishedReview,
      adapters.reviews.listReviewEvidence,
      adapters.readTextFile,
      adapters.changes.readChangeDiffs,
      adapters.reviews.refreshReviewActivity,
      new InterruptGitActionService(store, clock),
      lanes,
      laneKeys,
      events,
      { deadlineMs: limits.deadlineMs },
    ),
    readGitActionReceipt: new ReadGitActionReceiptUseCase(
      new ReadGitActionReceiptService(store),
      lanes,
    ),
    dismissInterruptedGitAction: new DismissInterruptedGitActionUseCase(
      new DismissInterruptedGitActionService(store, clock),
      lanes,
      laneKeys,
    ),
    listGitBranches: new ListGitBranchesUseCase(
      checkProject,
      adapters.checkWorktree,
      checkGitActionScope,
      new ListGitBranchesService(
        new GitGitBranchReader(adapters.worktreeAccess, adapters.actionGit),
      ),
      lanes,
      laneKeys,
    ),
    listCommitModels: new ListCommitModelsUseCase(
      new ListCommitModelsService(adapters.commitModelReader),
      lanes,
      { deadlineMs: limits.commitModelDeadlineMs },
    ),
    generateCommitDraft: new GenerateCommitDraftUseCase(
      checkProject,
      adapters.checkWorktree,
      checkGitActionScope,
      adapters.changes.readWorktreeStatus,
      adapters.changes.readChangeFingerprints,
      new CaptureCommitDraftService(
        new GitSelectedDiffReader(adapters.worktreeAccess, adapters.actionGit),
        new FilesystemUntrackedFileReader(adapters.fileReader),
        limits.commitDraft,
      ),
      new GenerateCommitDraftService(
        adapters.commitDraftSource,
        limits.commitGroups,
      ),
      lanes,
      laneKeys,
      { deadlineMs: limits.commitModelDeadlineMs },
    ),
    recoverInterruptedGitActions: new RecoverInterruptedGitActionsUseCase(
      new RecoverInterruptedGitActionsService(store, clock),
      expireGitActionReceipts,
      lanes,
      laneKeys,
    ),
  };
}
