import type {
  ReadReviewStatusInput,
  ReviewStatus,
} from '../models/read-review-evidence.ts';

export interface ReviewStatusReader {
  execute(
    input: ReadReviewStatusInput,
    signal?: AbortSignal,
  ): Promise<ReviewStatus>;
}
