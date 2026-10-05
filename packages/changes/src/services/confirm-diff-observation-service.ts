import { Effect, Context, Layer } from 'effect';
import { WorktreeChangedError } from '@porcelain/kernel/errors';
import {
  type DiffObservation,
  type ObservationProblem,
} from '../models/diff-observation.ts';
import { observationProblem } from '../rules/observation-problem.ts';

export class ConfirmDiffObservationService extends Context.Service<
  ConfirmDiffObservationService,
  {
    readonly execute: (
      input: DiffObservation,
    ) => Effect.Effect<void, WorktreeChangedError>;
  }
>()('@porcelain/changes/ConfirmDiffObservationService') {
  static readonly layer = Layer.effect(
    ConfirmDiffObservationService,
    Effect.sync(() => {
      function operationFailure(
        problem: ObservationProblem,
      ): WorktreeChangedError {
        switch (problem.kind) {
          case 'worktree-changed':
            return new WorktreeChangedError();
        }
      }
      return {
        execute: Effect.fn('ConfirmDiffObservationService.execute')(function* (
          input: DiffObservation,
        ): Effect.fn.Return<void, WorktreeChangedError> {
          const problem = observationProblem(input);
          if (problem) return yield* Effect.fail(operationFailure(problem));
        }),
      };
    }),
  );
}
