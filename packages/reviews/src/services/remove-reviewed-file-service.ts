import type {
  RemoveReviewedFileInput,
  RemoveReviewedFileResult,
} from '../models/reviewed-mark.ts';
import type { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import { reviewedMarks } from '../rules/reviewed-marks.ts';

export class RemoveReviewedFileService {
  private readonly reviewedFileStore: ReviewedFileStore;

  constructor(reviewedFileStore: ReviewedFileStore) {
    this.reviewedFileStore = reviewedFileStore;
  }

  execute(input: RemoveReviewedFileInput): RemoveReviewedFileResult {
    this.reviewedFileStore.remove(input.worktreeId, [input.path]);
    return {
      worktreeId: input.worktreeId,
      marks: reviewedMarks(this.reviewedFileStore.list(input.worktreeId)),
    };
  }
}
