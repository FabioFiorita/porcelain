import type { GitActionReceiptView } from './git-action-receipt-view.ts';

export type ReadGitActionReceiptInput = {
  worktreeId: string;
  requestId: string;
};

export type ReadGitActionReceiptResult = GitActionReceiptView;
