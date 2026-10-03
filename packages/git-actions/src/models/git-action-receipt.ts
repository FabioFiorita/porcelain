import type { GitActionExpectation } from './git-action-expectation.ts';
import type { GitActionIntent, GitActionKind } from './git-action-intent.ts';
import type { GitActionResult } from './git-action-outcome.ts';
import type { GitActionReason } from './git-action-reason.ts';

export type GitActionReceiptState =
  | 'running'
  | 'succeeded'
  | 'no-change'
  | 'rejected'
  | 'conflicted'
  | 'interrupted';

export type GitActionReceipt = {
  requestId: string;
  projectId: string;
  worktreeId: string;
  action: GitActionKind;
  intent: GitActionIntent;
  expected: GitActionExpectation;
  state: GitActionReceiptState;
  reason?: GitActionReason | undefined;
  message?: string | undefined;
  result?: GitActionResult | undefined;
  progress: string[];
  refreshRequired: boolean;
  acceptedAt: string;
  finishedAt?: string | undefined;
  dismissedAt?: string | undefined;
};

export type FinishedGitAction = { requestId: string; finishedAt: string };

export type GitActionReceiptKey = { requestId: string };

export type GitActionReceiptRemoval = { requestIds: string[] };
