import type { GitActionReceipt } from '../models/git-action-receipt.ts';
import type { AcceptGitActionInput } from '../models/accept-git-action.ts';

function sortedKeys(_key: string, value: unknown): unknown {
  if (!(value instanceof Object) || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => (left < right ? -1 : 1)),
  );
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left, sortedKeys) === JSON.stringify(right, sortedKeys);
}

export function sameGitActionRequest(
  receipt: GitActionReceipt,
  request: AcceptGitActionInput,
): boolean {
  return (
    receipt.projectId === request.projectId &&
    receipt.worktreeId === request.worktreeId &&
    sameValue(receipt.intent, request.intent) &&
    sameValue(receipt.expected, request.expected)
  );
}
