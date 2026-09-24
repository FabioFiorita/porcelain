import type { ReadReviewTextInput } from '../models/read-review-evidence.ts';
import type { ReviewText } from '../models/review-evidence.ts';

export interface ReviewTextReader {
  execute(
    input: ReadReviewTextInput,
    signal?: AbortSignal,
  ): Promise<ReviewText>;
}
