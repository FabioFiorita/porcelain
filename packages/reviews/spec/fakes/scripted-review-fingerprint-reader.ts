import type { FileChange } from '@porcelain/kernel/models';
import type {
  ReadReviewFingerprintsInput,
  ReviewFingerprints,
} from '../../src/models/read-review-evidence.ts';
import type { ReviewFingerprintReader } from '../../src/ports/review-fingerprint-reader.ts';

export class ScriptedReviewFingerprintReader implements ReviewFingerprintReader {
  private readonly changes: readonly FileChange[];

  constructor(changes: readonly FileChange[]) {
    this.changes = changes;
  }

  async execute(
    input: ReadReviewFingerprintsInput,
  ): Promise<ReviewFingerprints> {
    return {
      changes: this.changes.filter((change) =>
        change.comparisons.some((comparison) =>
          input.comparisons.includes(comparison),
        ),
      ),
    };
  }
}
