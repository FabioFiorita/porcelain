import type { TrackedComparison } from '@porcelain/kernel/models';
import { isTracked, trackedPath } from '@porcelain/kernel/rules';
import type {
  DiffComparisons,
  DiffComparisonsInput,
} from '../models/diff-comparisons.ts';

export function diffComparisons(input: DiffComparisonsInput): DiffComparisons {
  if (
    input.selections.some(
      (selection) =>
        selection.oldPath === undefined && selection.newPath === undefined,
    )
  )
    return { kind: 'unnamed-selection' };
  const expected = new Set(input.expectedFiles.map((file) => file.path));
  const selected = new Set(
    input.selections.map((selection) => trackedPath(selection) ?? ''),
  );
  if (
    expected.size !== input.expectedFiles.length ||
    expected.size !== selected.size ||
    [...selected].some((path) => !expected.has(path))
  )
    return { kind: 'selection-mismatch' };
  const comparisons: TrackedComparison[] = [];
  for (const selection of input.selections) {
    const comparison = input.status.changes.find(
      (entry): entry is TrackedComparison =>
        isTracked(entry) &&
        entry.scope === selection.scope &&
        entry.oldPath === selection.oldPath &&
        entry.newPath === selection.newPath,
    );
    if (comparison === undefined) return { kind: 'worktree-changed' };
    comparisons.push(comparison);
  }
  return { kind: 'selected', comparisons, paths: [...selected] };
}
