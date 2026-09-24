import { WorktreeChangedError } from '@porcelain/kernel/errors';
import { expectationHolds } from '@porcelain/kernel/rules';
import type { CheckDiffObservationInput } from '../models/check-diff-observation.ts';

export class CheckDiffObservationService {
  execute(input: CheckDiffObservationInput): void {
    if (input.statusToken !== input.expectedStatusToken)
      throw new WorktreeChangedError();
    const current = new Map(
      input.fingerprints.changes.map((change) => [
        change.path,
        change.fingerprint,
      ]),
    );
    if (!expectationHolds(input.expectedFiles, current))
      throw new WorktreeChangedError();
    if (
      input.previousStamp !== undefined &&
      input.previousStamp !== input.fingerprints.stamp
    )
      throw new WorktreeChangedError();
  }
}
