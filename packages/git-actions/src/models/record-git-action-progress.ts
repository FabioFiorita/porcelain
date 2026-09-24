import type { GitActionReceiptView } from './git-action-receipt-view.ts';

export type RecordGitActionProgressInput = { requestId: string; line: string };

export type RecordGitActionProgressResult =
  | { kind: 'recorded'; receipt: GitActionReceiptView }
  | { kind: 'not-running' };
