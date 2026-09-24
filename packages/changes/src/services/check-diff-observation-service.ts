import { WorktreeChangedError } from '../errors/worktree-changed-error.ts';
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
    for (const file of input.expectedFiles)
      if (current.get(file.path) !== file.fingerprint)
        throw new WorktreeChangedError();
    if (
      input.previousStamp !== undefined &&
      input.previousStamp !== input.fingerprints.stamp
    )
      throw new WorktreeChangedError();
  }
}
