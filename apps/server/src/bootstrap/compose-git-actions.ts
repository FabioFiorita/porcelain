import type { FileReader } from '@porcelain/files/ports';
import type {
  CommitDraftWriter,
  CommitModelReader,
} from '@porcelain/git-actions/ports';
import {
  AcceptGitActionService,
  CaptureCommitDraftService,
  CheckWorktreeService,
  DismissInterruptedGitActionService,
  ExpireGitActionReceiptsService,
  FinishGitActionService,
  GenerateCommitDraftService,
  ListCommitModelsService,
  ListGitBranchesService,
  ReadGitActionReceiptService,
  RecordGitActionProgressService,
  RecoverInterruptedGitActionsService,
  RunGitActionService,
} from '@porcelain/git-actions/services';
import type { GitActionWriterFactory } from '@porcelain/git/actions';
import type { ListedWorktree } from '@porcelain/projects/models';
import type { WorktreeAccess } from '@porcelain/kernel/ports';
import { CheckProjectService } from '@porcelain/projects/services';
import type { StorageSession } from '@porcelain/storage';
import { createGitActionStore } from '@porcelain/storage/git-actions';
import { createInventoryStore } from '@porcelain/storage/projects';
import { ActionCheckouts } from '../adapters/git-actions/action-checkout.ts';
import { SystemClock } from '../adapters/runtime/system-clock.ts';
import { GitCommitDraftReader } from '../adapters/git-actions/git-commit-draft-reader.ts';
import { GitGitActionWriter } from '../adapters/git-actions/git-git-action-writer.ts';
import { GitGitBranchReader } from '../adapters/git-actions/git-git-branch-reader.ts';
import { WorktreeFingerprintReaderAdapter } from '../adapters/git-actions/worktree-fingerprint-reader-adapter.ts';
import { DismissInterruptedGitActionUseCase } from '../use-cases/git-actions/dismiss-interrupted-git-action.ts';
import { GenerateCommitDraftUseCase } from '../use-cases/git-actions/generate-commit-draft.ts';
import { ListCommitModelsUseCase } from '../use-cases/git-actions/list-commit-models.ts';
import { ListGitBranchesUseCase } from '../use-cases/git-actions/list-git-branches.ts';
import { ReadGitActionReceiptUseCase } from '../use-cases/git-actions/read-git-action-receipt.ts';
import { RecoverInterruptedGitActionsUseCase } from '../use-cases/git-actions/recover-interrupted-git-actions.ts';
import {
  RunGitActionUseCase,
  type PublishedReviewRefresh,
} from '../use-cases/git-actions/run-git-action.ts';
import type { EventPublisher } from '../ports/event-publisher.ts';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { composeChanges } from './compose-changes.ts';

type ChangesServices = ReturnType<typeof composeChanges>['services'];

const UNTRACKED_DRAFT_READ_BYTES = 1024 * 1024;

export type GitActionsDependencies = {
  session: StorageSession;
  lanes: Lanes;
  laneKeys: LaneKeys;
  events: EventPublisher;
  worktreeAccess: WorktreeAccess<ListedWorktree>;
  actionGit: GitActionWriterFactory;
  fileReader: Pick<FileReader, 'readText'>;
  changes: ChangesServices;
  refreshPublishedReview: PublishedReviewRefresh;
  commitGenerator: CommitDraftWriter & CommitModelReader;
  gitActionDeadlineMs: number;
  commitModelDeadlineMs: number;
};

export function composeGitActions(deps: GitActionsDependencies) {
  const store = createGitActionStore(deps.session);
  const clock = new SystemClock();
  const checkouts = new ActionCheckouts(deps.worktreeAccess);
  const checkProject = new CheckProjectService(
    createInventoryStore(deps.session),
  );
  const checkWorktree = new CheckWorktreeService(deps.worktreeAccess);
  const expireGitActionReceipts = new ExpireGitActionReceiptsService(
    store,
    clock,
  );
  return {
    runGitAction: new RunGitActionUseCase(
      checkProject,
      checkWorktree,
      expireGitActionReceipts,
      new AcceptGitActionService(store, clock),
      new RunGitActionService(
        new WorktreeFingerprintReaderAdapter(deps.changes),
        new GitGitActionWriter(checkouts, deps.actionGit),
      ),
      new RecordGitActionProgressService(store),
      new FinishGitActionService(store, clock),
      deps.refreshPublishedReview,
      deps.lanes,
      deps.laneKeys,
      deps.events,
      { deadlineMs: deps.gitActionDeadlineMs },
    ),
    readGitActionReceipt: new ReadGitActionReceiptUseCase(
      new ReadGitActionReceiptService(store),
      deps.lanes,
    ),
    dismissInterruptedGitAction: new DismissInterruptedGitActionUseCase(
      new DismissInterruptedGitActionService(store, clock),
      deps.lanes,
    ),
    listGitBranches: new ListGitBranchesUseCase(
      checkProject,
      checkWorktree,
      new ListGitBranchesService(
        new GitGitBranchReader(checkouts, deps.actionGit),
      ),
      deps.lanes,
      deps.laneKeys,
    ),
    listCommitModels: new ListCommitModelsUseCase(
      new ListCommitModelsService(deps.commitGenerator),
      deps.lanes,
      { deadlineMs: deps.commitModelDeadlineMs },
    ),
    generateCommitDraft: new GenerateCommitDraftUseCase(
      checkProject,
      checkWorktree,
      new CaptureCommitDraftService(
        new GitCommitDraftReader(
          deps.changes,
          checkouts,
          deps.actionGit,
          deps.fileReader,
          UNTRACKED_DRAFT_READ_BYTES,
        ),
      ),
      new GenerateCommitDraftService(deps.commitGenerator),
      deps.lanes,
      deps.laneKeys,
      { deadlineMs: deps.commitModelDeadlineMs },
    ),
    recoverInterruptedGitActions: new RecoverInterruptedGitActionsUseCase(
      new RecoverInterruptedGitActionsService(store, store, clock),
      expireGitActionReceipts,
    ),
  };
}
