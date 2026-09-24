import type {
  ListReviewedFilesInput,
  ListReviewedFilesResult,
} from '../models/list-reviewed-files.ts';
import type { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import { reviewedMarks } from '../rules/reviewed-marks.ts';

export class ListReviewedFilesService {
  private readonly reviewedFiles: ReviewedFileStore;

  constructor(reviewedFiles: ReviewedFileStore) {
    this.reviewedFiles = reviewedFiles;
  }

  execute(input: ListReviewedFilesInput): ListReviewedFilesResult {
    const { worktreeId } = input;
    return {
      worktreeId,
      marks: reviewedMarks(this.reviewedFiles.list({ worktreeId })),
    };
  }
}
