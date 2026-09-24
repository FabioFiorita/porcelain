import type {
  RemoveReviewedFileInput,
  RemoveReviewedFileResult,
} from '../models/remove-reviewed-file.ts';
import type { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import { reviewedMarks } from '../rules/reviewed-marks.ts';

export class RemoveReviewedFileService {
  private readonly reviewedFiles: ReviewedFileStore;

  constructor(reviewedFiles: ReviewedFileStore) {
    this.reviewedFiles = reviewedFiles;
  }

  execute(input: RemoveReviewedFileInput): RemoveReviewedFileResult {
    const { worktreeId } = input;
    const removed = this.reviewedFiles
      .list({ worktreeId })
      .some((mark) => mark.path === input.path);
    if (removed) this.reviewedFiles.remove({ worktreeId, paths: [input.path] });
    return {
      worktreeId,
      marks: reviewedMarks(this.reviewedFiles.list({ worktreeId })),
      removed,
    };
  }
}
