import type { TrackedComparison } from '@porcelain/kernel/models';
import { isTracked, trackedPath } from '@porcelain/kernel/rules';
import type { ChangeSelection } from '../models/change-diff.ts';
import type {
  DiffSelection,
  DiffSelectionInput,
  DiffSelectionProblem,
} from '../models/diff-selection.ts';

function listed(
  input: DiffSelectionInput,
  selection: ChangeSelection,
): TrackedComparison[] {
  return input.status.changes.filter(
    (entry): entry is TrackedComparison =>
      isTracked(entry) &&
      entry.scope === selection.scope &&
      entry.oldPath === selection.oldPath &&
      entry.newPath === selection.newPath,
  );
}

function selectedPaths(input: DiffSelectionInput): Set<string> {
  return new Set(
    input.selections.map((selection) => trackedPath(selection) ?? ''),
  );
}

export function diffSelectionProblem(
  input: DiffSelectionInput,
): DiffSelectionProblem | undefined {
  if (
    input.selections.some(
      (selection) =>
        selection.oldPath === undefined && selection.newPath === undefined,
    )
  )
    return { kind: 'unnamed-selection' };
  const expected = new Set(input.expectedFiles.map((file) => file.path));
  const selected = selectedPaths(input);
  if (
    expected.size !== input.expectedFiles.length ||
    expected.size !== selected.size ||
    [...selected].some((path) => !expected.has(path))
  )
    return { kind: 'selection-mismatch' };
  if (
    input.selections.some((selection) => listed(input, selection).length === 0)
  )
    return { kind: 'worktree-changed' };
  return undefined;
}

export function diffSelection(input: DiffSelectionInput): DiffSelection {
  return {
    comparisons: input.selections.flatMap((selection) =>
      listed(input, selection).slice(0, 1),
    ),
    paths: [...selectedPaths(input)],
  };
}
