import { expectationHolds } from '@porcelain/kernel/rules';
import type { DiffObservation } from '../models/diff-observation.ts';

export function observationHolds(input: DiffObservation): boolean {
  const current = new Map(
    input.fingerprints.changes.map((change) => [
      change.path,
      change.fingerprint,
    ]),
  );
  return (
    input.statusToken === input.expectedStatusToken &&
    expectationHolds(input.expectedFiles, current) &&
    (input.previousStamp === undefined ||
      input.previousStamp === input.fingerprints.stamp)
  );
}
