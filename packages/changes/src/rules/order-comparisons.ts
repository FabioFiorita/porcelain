import type { ChangeComparison } from '@porcelain/kernel/models';
import { logicalPath } from './logical-path.ts';

const scopeOrder = {
  staged: 0,
  unstaged: 1,
  untracked: 2,
  unmerged: 3,
} as const;

export function orderComparisons(
  comparisons: readonly ChangeComparison[],
): ChangeComparison[] {
  return comparisons.toSorted((left, right) => {
    const difference = scopeOrder[left.scope] - scopeOrder[right.scope];
    if (difference !== 0) return difference;
    return logicalPath(left).localeCompare(logicalPath(right));
  });
}
