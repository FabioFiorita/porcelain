import { WorktreeChangedError } from '@porcelain/kernel/errors';
import type { TrackedComparison } from '@porcelain/kernel/models';
import { isTracked, trackedPath } from '@porcelain/kernel/rules';
import { SelectionMismatchError } from '../errors/selection-mismatch-error.ts';
import { UnnamedDiffSelectionError } from '../errors/unnamed-diff-selection-error.ts';
import type {
  ReadDiffComparisonsInput,
  ReadDiffComparisonsResult,
} from '../models/read-diff-comparisons.ts';

export class ReadDiffComparisonsService {
  execute(input: ReadDiffComparisonsInput): ReadDiffComparisonsResult {
    if (
      input.selections.some(
        (selection) =>
          selection.oldPath === undefined && selection.newPath === undefined,
      )
    )
      throw new UnnamedDiffSelectionError();
    const expected = new Set(input.expectedFiles.map((file) => file.path));
    const selected = new Set(
      input.selections.map((selection) => trackedPath(selection) ?? ''),
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
          isTracked(entry) &&
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
