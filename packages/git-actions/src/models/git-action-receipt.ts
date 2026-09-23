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
  reason?: GitActionReason;
  message?: string;
  result?: GitActionResult;
  progress: string[];
  refreshRequired: boolean;
  acceptedAt: number;
  finishedAt?: number;
  dismissedAt?: number;
};
