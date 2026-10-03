import type { GitActionReceiptView } from './git-action-receipt-view.ts';

export type ReadInterruptedGitActionInput = { worktreeId: string };

export type ReadInterruptedGitActionResult =
  | { kind: 'interrupted'; receipt: GitActionReceiptView }
  | { kind: 'none' };
