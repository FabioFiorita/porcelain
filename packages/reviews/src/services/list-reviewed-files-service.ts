import type {
  ListReviewedFilesInput,
  ListReviewedFilesResult,
} from '../models/reviewed-mark.ts';
import type { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import { reviewedMarks } from '../rules/reviewed-marks.ts';

export class ListReviewedFilesService {
  private readonly reviewedFileStore: ReviewedFileStore;

  constructor(reviewedFileStore: ReviewedFileStore) {
    this.reviewedFileStore = reviewedFileStore;
  }

  execute(input: ListReviewedFilesInput): ListReviewedFilesResult {
    return {
      worktreeId: input.worktreeId,
      marks: reviewedMarks(this.reviewedFileStore.list(input.worktreeId)),
    };
  }
}
