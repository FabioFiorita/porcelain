import type { GitActionReceipt } from '../models/git-action-receipt.ts';
import type { AcceptGitActionInput } from '../models/git-action-operations.ts';

export function sameGitActionRequest(
  receipt: GitActionReceipt,
  request: AcceptGitActionInput,
): boolean {
  return (
    receipt.projectId === request.projectId &&
    receipt.worktreeId === request.worktreeId &&
    JSON.stringify(receipt.intent) === JSON.stringify(request.intent) &&
    JSON.stringify(receipt.expected) === JSON.stringify(request.expected)
  );
}
