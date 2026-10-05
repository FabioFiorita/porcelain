import { Effect, Context, Layer } from 'effect';
import { WorktreeChangedError } from '@porcelain/kernel/errors';
import { SelectionMismatchError } from '../errors/selection-mismatch-error.ts';
import { UnnamedDiffSelectionError } from '../errors/unnamed-diff-selection-error.ts';
import {
  type DiffSelection,
  type DiffSelectionInput,
  type DiffSelectionProblem,
} from '../models/diff-selection.ts';
import {
  diffSelectionProblem,
  matchDiffSelections,
} from '../rules/match-diff-selections.ts';

export class CheckDiffSelectionService extends Context.Service<
  CheckDiffSelectionService,
  {
    readonly execute: (
      input: DiffSelectionInput,
    ) => Effect.Effect<
      DiffSelection,
      SelectionMismatchError | UnnamedDiffSelectionError | WorktreeChangedError
    >;
  }
>()('@porcelain/changes/CheckDiffSelectionService') {
  static readonly layer = Layer.effect(
    CheckDiffSelectionService,
    Effect.sync(() => {
      function operationFailure(
        problem: DiffSelectionProblem,
      ):
        | SelectionMismatchError
        | UnnamedDiffSelectionError
        | WorktreeChangedError {
        switch (problem.kind) {
          case 'unnamed-selection':
            return new UnnamedDiffSelectionError();
          case 'selection-mismatch':
            return new SelectionMismatchError();
          case 'worktree-changed':
            return new WorktreeChangedError();
        }
      }
      return {
        execute: Effect.fn('CheckDiffSelectionService.execute')(function* (
          input: DiffSelectionInput,
        ): Effect.fn.Return<
          DiffSelection,
          | SelectionMismatchError
          | UnnamedDiffSelectionError
          | WorktreeChangedError
        > {
          const problem = diffSelectionProblem(input);
          if (problem) return yield* Effect.fail(operationFailure(problem));
          return matchDiffSelections(input);
        }),
      };
    }),
  );
}
