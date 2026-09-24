import type { GitActionOutcome } from './git-action-outcome.ts';
import type { GitActionReceiptView } from './git-action-receipt-view.ts';

export type FinishGitActionInput = {
  requestId: string;
  outcome: GitActionOutcome;
};

export type FinishGitActionResult = GitActionReceiptView;
