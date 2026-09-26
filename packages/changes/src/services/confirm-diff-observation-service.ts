import { WorktreeChangedError } from '@porcelain/kernel/errors';
import type {
  DiffObservation,
  ObservationProblem,
} from '../models/diff-observation.ts';
import { observationProblem } from '../rules/observation-problem.ts';

export class ConfirmDiffObservationService {
  execute(input: DiffObservation): void {
    const problem = observationProblem(input);
    if (problem) throw this.failure(problem);
  }

  private failure(problem: ObservationProblem): Error {
    switch (problem.kind) {
      case 'worktree-changed':
        return new WorktreeChangedError();
    }
  }
}
