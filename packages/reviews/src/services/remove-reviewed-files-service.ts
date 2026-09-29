import type {
  RemoveReviewedFilesInput,
  RemoveReviewedFilesResult,
} from '../models/remove-reviewed-files.ts';
import type { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import { reviewedMarks } from '../rules/reviewed-marks.ts';

export class RemoveReviewedFilesService {
  private readonly reviewedFiles: ReviewedFileStore;

  constructor(reviewedFiles: ReviewedFileStore) {
    this.reviewedFiles = reviewedFiles;
  }

  execute(input: RemoveReviewedFilesInput): RemoveReviewedFilesResult {
    const { worktreeId, scope, branch } = input;
    const wanted = new Set(input.paths);
    const removed = this.reviewedFiles
      .list({ worktreeId, scope, branch })
      .filter((mark) => wanted.has(mark.path))
      .map((mark) => mark.path);
    this.reviewedFiles.remove({ worktreeId, scope, branch, paths: removed });
    return {
      worktreeId,
      marks: reviewedMarks(
        this.reviewedFiles.list({ worktreeId, scope, branch }),
      ),
      removed: removed.length > 0,
    };
  }
}
