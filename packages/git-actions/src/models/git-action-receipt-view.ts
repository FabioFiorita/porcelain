import type { GitActionReceipt } from './git-action-receipt.ts';

export type GitActionReceiptView = Pick<
  GitActionReceipt,
  | 'requestId'
  | 'projectId'
  | 'worktreeId'
  | 'action'
  | 'state'
  | 'reason'
  | 'message'
  | 'result'
  | 'progress'
  | 'acceptedAt'
  | 'finishedAt'
>;
