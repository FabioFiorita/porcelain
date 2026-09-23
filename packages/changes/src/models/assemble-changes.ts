import type { ChangeComparison, FileChange, WorktreeSide } from './change.ts';
import {
  fingerprintChange,
  logicalPath,
  orderComparisons,
} from './fingerprint-change.ts';

export function assembleChanges(
  observations: readonly ChangeComparison[],
  sides: ReadonlyMap<string, WorktreeSide>,
): FileChange[] {
  const byPath = new Map<string, ChangeComparison[]>();
  for (const change of observations) {
    const path = logicalPath(change);
    byPath.set(path, [...(byPath.get(path) ?? []), change]);
  }
  return [...byPath.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, comparisons]) => {
      const ordered = orderComparisons(comparisons);
      return {
        path,
        fingerprint: fingerprintChange(path, ordered, (file) =>
          sides.get(file),
        ),
        comparisons: ordered,
      };
    });
}
