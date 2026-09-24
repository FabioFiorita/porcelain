import { logicalPath } from '@porcelain/kernel/rules';
import type { ChangeComparison, FileChange } from '@porcelain/kernel/models';
import type { WorktreeSide } from '../models/worktree-side.ts';
import { fingerprintChange } from './fingerprint-change.ts';
import { orderComparisons } from './order-comparisons.ts';

export function assembleChanges(
  comparisons: readonly ChangeComparison[],
  sides: ReadonlyMap<string, WorktreeSide>,
): FileChange[] {
  const byPath = new Map<string, ChangeComparison[]>();
  for (const comparison of comparisons) {
    const path = logicalPath(comparison);
    byPath.set(path, [...(byPath.get(path) ?? []), comparison]);
  }
  return [...byPath.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, grouped]) => {
      const ordered = orderComparisons(grouped);
      return {
        path,
        fingerprint: fingerprintChange(path, ordered, sides),
        comparisons: ordered,
      };
    });
}
