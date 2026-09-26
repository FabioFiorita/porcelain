import type {
  InvalidateReviewedMarksInput,
  InvalidateReviewedMarksResult,
} from '../models/invalidate-reviewed-marks.ts';
import type { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import { touchedMarks } from '../rules/reviewed-marks.ts';

export class InvalidateReviewedMarksService {
  private readonly reviewedFiles: ReviewedFileStore;

  constructor(reviewedFiles: ReviewedFileStore) {
    this.reviewedFiles = reviewedFiles;
  }

  execute(input: InvalidateReviewedMarksInput): InvalidateReviewedMarksResult {
    const { worktreeId, paths } = input;
    if (paths?.length === 0) return { changed: false };
    const files = touchedMarks(
      this.reviewedFiles
        .list({ worktreeId })
        .filter((mark) => !mark.stale)
        .map((mark) => mark.path),
      paths,
    );
    this.reviewedFiles.setStale({ worktreeId, paths: files, stale: true });
    return { changed: files.length > 0 };
  }
}
