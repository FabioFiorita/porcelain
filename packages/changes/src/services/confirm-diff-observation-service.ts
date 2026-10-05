import { Effect } from 'effect';
import { WorktreeChangedError } from '@porcelain/kernel/errors';
import type {
  DiffObservation,
  ObservationProblem,
} from '../models/diff-observation.ts';
import { observationProblem } from '../rules/observation-problem.ts';

export class ConfirmDiffObservationService {
  execute(input: DiffObservation): Effect.Effect<void, WorktreeChangedError> {
    return Effect.gen({ self: this }, function* () {
      const problem = observationProblem(input);
      if (problem) return yield* Effect.fail(this.failure(problem));
    });
  }

  private failure(problem: ObservationProblem): WorktreeChangedError {
    switch (problem.kind) {
      case 'worktree-changed':
        return new WorktreeChangedError();
    }
  }
}
