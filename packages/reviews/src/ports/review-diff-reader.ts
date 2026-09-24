import type { ReadReviewDiffsInput } from '../models/read-review-evidence.ts';
import type { ReviewDiff } from '../models/review-evidence.ts';

export interface ReviewDiffReader {
  execute(
    input: ReadReviewDiffsInput,
    signal?: AbortSignal,
  ): Promise<ReviewDiff[]>;
}
