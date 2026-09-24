import type {
  ReadReviewFingerprintsInput,
  ReviewFingerprints,
} from '../models/read-review-evidence.ts';

export interface ReviewFingerprintReader {
  execute(
    input: ReadReviewFingerprintsInput,
    signal?: AbortSignal,
  ): Promise<ReviewFingerprints>;
}
