import { SelectionMismatchError } from '../errors/selection-mismatch-error.ts';
import { WorktreeChangedError } from '../errors/worktree-changed-error.ts';
import type { TrackedComparison } from '../models/change.ts';
import type { DiffSelection } from '../models/change-diff.ts';
import type { SelectDiffComparisonsInput } from '../models/operation-inputs.ts';

export class SelectDiffComparisonsService {
  execute(input: SelectDiffComparisonsInput): DiffSelection {
    const expected = new Set(input.expectedFiles.map((file) => file.path));
    const selected = new Set(
      input.selections.map(
        (selection) => selection.newPath ?? selection.oldPath ?? '',
      ),
    );
    if (
      expected.size !== input.expectedFiles.length ||
      expected.size !== selected.size ||
      [...selected].some((path) => !expected.has(path))
    )
      throw new SelectionMismatchError();
    const comparisons = input.selections.map((selection) => {
      const comparison = input.status.changes.find(
        (entry): entry is TrackedComparison =>
          (entry.scope === 'staged' || entry.scope === 'unstaged') &&
          entry.scope === selection.scope &&
          entry.oldPath === selection.oldPath &&
          entry.newPath === selection.newPath,
      );
      if (comparison === undefined) throw new WorktreeChangedError();
      return comparison;
    });
    return { comparisons, paths: [...selected] };
  }
}
