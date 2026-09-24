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
  ReadInterruptedGitActionService,
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
import { SystemClockAdapter } from '../adapters/runtime/system-clock-adapter.ts';
import { CommitDraftReaderAdapter } from '../adapters/git-actions/commit-draft-reader-adapter.ts';
import { GitActionWriterAdapter } from '../adapters/git-actions/git-action-writer-adapter.ts';
import { GitBranchReaderAdapter } from '../adapters/git-actions/git-branch-reader-adapter.ts';
import { WorktreeFingerprintReaderAdapter } from '../adapters/git-actions/worktree-fingerprint-reader-adapter.ts';
import { DismissInterruptedGitActionController } from '../controllers/dismiss-interrupted-git-action-controller.ts';
import { GenerateCommitDraftController } from '../controllers/generate-commit-draft-controller.ts';
import { ListCommitModelsController } from '../controllers/list-commit-models-controller.ts';
import { ListGitBranchesController } from '../controllers/list-git-branches-controller.ts';
import { ReadGitActionReceiptController } from '../controllers/read-git-action-receipt-controller.ts';
import { RecoverInterruptedGitActionsController } from '../controllers/recover-interrupted-git-actions-controller.ts';
import {
  RunGitActionController,
  type PublishedReviewRefresh,
} from '../controllers/run-git-action-controller.ts';
import type { EventPublisher } from '../runtime/event-publisher.ts';
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
  const clock = new SystemClockAdapter();
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
    runGitActionController: new RunGitActionController(
      checkProject,
      checkWorktree,
      expireGitActionReceipts,
      new AcceptGitActionService(store, clock),
      new RunGitActionService(
        new WorktreeFingerprintReaderAdapter(deps.changes),
        new GitActionWriterAdapter(checkouts, deps.actionGit),
      ),
      new RecordGitActionProgressService(store),
      new FinishGitActionService(store, clock),
      deps.refreshPublishedReview,
      deps.lanes,
      deps.laneKeys,
      deps.events,
      { deadlineMs: deps.gitActionDeadlineMs },
    ),
    readGitActionReceiptController: new ReadGitActionReceiptController(
      new ReadGitActionReceiptService(store),
      deps.lanes,
    ),
    dismissInterruptedGitActionController:
      new DismissInterruptedGitActionController(
        new DismissInterruptedGitActionService(store, clock),
        deps.lanes,
      ),
    listGitBranchesController: new ListGitBranchesController(
      checkProject,
      checkWorktree,
      new ListGitBranchesService(
        new GitBranchReaderAdapter(checkouts, deps.actionGit),
      ),
      deps.lanes,
      deps.laneKeys,
    ),
    listCommitModelsController: new ListCommitModelsController(
      new ListCommitModelsService(deps.commitGenerator),
      deps.lanes,
      { deadlineMs: deps.commitModelDeadlineMs },
    ),
    generateCommitDraftController: new GenerateCommitDraftController(
      checkProject,
      checkWorktree,
      new CaptureCommitDraftService(
        new CommitDraftReaderAdapter(
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
    recoverInterruptedGitActionsController:
      new RecoverInterruptedGitActionsController(
        new RecoverInterruptedGitActionsService(store, store, clock),
        expireGitActionReceipts,
      ),
    readInterruptedGitActionService: new ReadInterruptedGitActionService(store),
  };
}
