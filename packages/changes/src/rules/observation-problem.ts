import { expectationHolds } from '@porcelain/kernel/rules';
import type {
  DiffObservation,
  ObservationProblem,
} from '../models/diff-observation.ts';

export function observationProblem(
  input: DiffObservation,
): ObservationProblem | undefined {
  const current = new Map(
    input.fingerprints.changes.map((change) => [
      change.path,
      change.fingerprint,
    ]),
  );
  const holds =
    input.statusToken === input.expectedStatusToken &&
    expectationHolds(input.expectedFiles, current) &&
    (input.previousStamp === undefined ||
      input.previousStamp === input.fingerprints.stamp);
  return holds ? undefined : { kind: 'worktree-changed' };
}
