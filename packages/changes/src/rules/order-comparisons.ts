import { logicalPath } from '@porcelain/kernel/rules';
import type { ChangeComparison } from '@porcelain/kernel/models';

const SCOPE_ORDER: readonly ChangeComparison['scope'][] = [
  'staged',
  'unstaged',
  'untracked',
  'unmerged',
];

export function orderComparisons(
  comparisons: readonly ChangeComparison[],
): ChangeComparison[] {
  return comparisons.toSorted((left, right) => {
    const difference =
      SCOPE_ORDER.indexOf(left.scope) - SCOPE_ORDER.indexOf(right.scope);
    if (difference !== 0) return difference;
    return logicalPath(left).localeCompare(logicalPath(right));
  });
}
