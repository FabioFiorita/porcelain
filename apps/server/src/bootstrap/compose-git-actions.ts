import type { FileReader } from '@porcelain/files/ports';
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
import type { WorktreeAccess } from '@porcelain/kernel/ports';
import type { ListedWorktree } from '@porcelain/projects/models';
import { CheckProjectService } from '@porcelain/projects/services';
import type { StorageSession } from '@porcelain/storage';
import { createGitActionStore } from '@porcelain/storage/git-actions';
import { createInventoryStore } from '@porcelain/storage/projects';
import { FilesystemUntrackedFileReader } from '../adapters/git-actions/filesystem-untracked-file-reader.ts';
import { GitGitActionRunner } from '../adapters/git-actions/git-git-action-runner.ts';
import { GitGitBranchReader } from '../adapters/git-actions/git-git-branch-reader.ts';
import { GitSelectedDiffReader } from '../adapters/git-actions/git-selected-diff-reader.ts';
import { SystemClock } from '../adapters/runtime/system-clock.ts';
import type { EventPublisher } from '../ports/event-publisher.ts';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
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
import type { composeChanges } from './compose-changes.ts';

type ChangesServices = ReturnType<typeof composeChanges>['services'];

const MEBIBYTE = 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;

const limits = {
  receipts: { retentionMs: 30 * DAY_MS },
  progress: { progressLines: 200 },
  commitDraft: {
    maxComparisons: 200,
    maxEvidenceBytes: MEBIBYTE,
    maxUntrackedBytes: MEBIBYTE,
  },
  commitGroups: { maxGroups: 20, maxMessageBytes: 16_384 },
};

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
  commitDraftSource: CommitDraftSource;
  commitModelReader: CommitModelReader;
  gitActionDeadlineMs: number;
  commitModelDeadlineMs: number;
};

export function composeGitActions(deps: GitActionsDependencies) {
  const store = createGitActionStore(deps.session);
  const clock = new SystemClock();
  const checkProject = new CheckProjectService(
    createInventoryStore(deps.session),
  );
  const checkGitActionScope = new CheckGitActionScopeService();
  const expireGitActionReceipts = new ExpireGitActionReceiptsService(
    store,
    clock,
    limits.receipts,
  );
  return {
    runGitAction: new RunGitActionUseCase(
      checkProject,
      deps.changes.checkWorktree,
      checkGitActionScope,
      expireGitActionReceipts,
      new AcceptGitActionService(store, clock),
      deps.changes.readWorktreeStatus,
      deps.changes.readChangeFingerprints,
      new RunGitActionService(
        new GitGitActionRunner(deps.worktreeAccess, deps.actionGit),
      ),
      new RecordGitActionProgressService(store, limits.progress),
      deps.refreshPublishedReview,
      new FinishGitActionService(store, clock),
      new InterruptGitActionService(store, clock),
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
      deps.laneKeys,
    ),
    listGitBranches: new ListGitBranchesUseCase(
      checkProject,
      deps.changes.checkWorktree,
      checkGitActionScope,
      new ListGitBranchesService(
        new GitGitBranchReader(deps.worktreeAccess, deps.actionGit),
      ),
      deps.lanes,
      deps.laneKeys,
    ),
    listCommitModels: new ListCommitModelsUseCase(
      new ListCommitModelsService(deps.commitModelReader),
      deps.lanes,
      { deadlineMs: deps.commitModelDeadlineMs },
    ),
    generateCommitDraft: new GenerateCommitDraftUseCase(
      checkProject,
      deps.changes.checkWorktree,
      checkGitActionScope,
      deps.changes.readWorktreeStatus,
      deps.changes.readChangeFingerprints,
      new CaptureCommitDraftService(
        new GitSelectedDiffReader(deps.worktreeAccess, deps.actionGit),
        new FilesystemUntrackedFileReader(deps.fileReader),
        limits.commitDraft,
      ),
      new GenerateCommitDraftService(
        deps.commitDraftSource,
        limits.commitGroups,
      ),
      deps.lanes,
      deps.laneKeys,
      { deadlineMs: deps.commitModelDeadlineMs },
    ),
    recoverInterruptedGitActions: new RecoverInterruptedGitActionsUseCase(
      new RecoverInterruptedGitActionsService(store, clock),
      expireGitActionReceipts,
      deps.lanes,
      deps.laneKeys,
    ),
  };
}
