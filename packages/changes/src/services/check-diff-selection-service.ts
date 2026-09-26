import { WorktreeChangedError } from '@porcelain/kernel/errors';
import { SelectionMismatchError } from '../errors/selection-mismatch-error.ts';
import { UnnamedDiffSelectionError } from '../errors/unnamed-diff-selection-error.ts';
import type {
  DiffSelection,
  DiffSelectionInput,
  DiffSelectionProblem,
} from '../models/diff-selection.ts';
import {
  diffSelectionProblem,
  matchDiffSelections,
} from '../rules/match-diff-selections.ts';

export class CheckDiffSelectionService {
  execute(input: DiffSelectionInput): DiffSelection {
    const problem = diffSelectionProblem(input);
    if (problem) throw this.failure(problem);
    return matchDiffSelections(input);
  }

  private failure(problem: DiffSelectionProblem): Error {
    switch (problem.kind) {
      case 'unnamed-selection':
        return new UnnamedDiffSelectionError();
      case 'selection-mismatch':
        return new SelectionMismatchError();
      case 'worktree-changed':
        return new WorktreeChangedError();
    }
  }
}
