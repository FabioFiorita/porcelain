import type { GitActionExpectation } from './git-action-expectation.ts';
import type { GitActionIntent } from './git-action-intent.ts';
import type { GitActionOutcome } from './git-action-outcome.ts';
import type { GitActionReceiptView } from './git-action-receipt-view.ts';
import type {
  GitActionProgressListener,
  GitActionRun,
} from './git-action-run.ts';
import type { GitActionScope } from './git-action-scope.ts';

export type CheckWorktreeInput = { worktreeId: string };

export type ExpireGitActionReceiptsInput = Record<never, never>;

export type AcceptGitActionInput = GitActionScope & {
  requestId: string;
  intent: GitActionIntent;
  expected: GitActionExpectation;
};

export type AcceptGitActionResult = {
  receipt: GitActionReceiptView;
  run: GitActionRun | undefined;
};

export type RunGitActionInput = {
  run: GitActionRun;
  onProgress?: GitActionProgressListener | undefined;
};

export type RunGitActionResult = {
  outcome: GitActionOutcome;
  reviewStale: boolean;
};

export type FinishGitActionInput = {
  requestId: string;
  outcome: GitActionOutcome;
};

export type RecordGitActionProgressInput = { requestId: string; line: string };

export type ReadGitActionReceiptInput = { requestId: string };

export type ReadInterruptedGitActionInput = { worktreeId: string };

export type DismissInterruptedGitActionInput = GitActionScope & {
  requestId: string;
};

export type RecoverInterruptedGitActionsInput = Record<never, never>;
