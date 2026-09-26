import type { GitActionReceiptView } from './git-action-receipt-view.ts';
import type { GitActionScope } from './git-action-scope.ts';

export type DismissInterruptedGitActionInput = GitActionScope & {
  requestId: string;
};

export type DismissInterruptedGitActionResult = {
  kind: 'dismissed' | 'already-dismissed';
  receipt: GitActionReceiptView;
};
