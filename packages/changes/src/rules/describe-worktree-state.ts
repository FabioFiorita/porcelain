import type { FileChange } from '@porcelain/kernel/models';
import type { BranchStatus } from '../models/change-status.ts';

export function describeWorktreeState(
  changes: readonly FileChange[],
  branch: BranchStatus | undefined,
): string {
  const on = branch?.name ?? 'detached HEAD';
  const conflicts = changes.filter((change) =>
    change.comparisons.some((comparison) => comparison.scope === 'unmerged'),
  ).length;
  if (conflicts > 0)
    return `${conflicts} unresolved ${remain(conflicts)} on ${on}.`;
  if (changes.length > 0)
    return `${changes.length} changed ${remain(changes.length)} on ${on}.`;
  return `The worktree is clean on ${on}.`;
}

function remain(count: number): string {
  return count === 1 ? 'path remains' : 'paths remain';
}
