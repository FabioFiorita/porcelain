import type { ReconcileReviewedFilesInput } from '../models/reconcile-reviewed-files.ts';
import type { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import { markStaleness } from '../rules/reviewed-marks.ts';

export class ReconcileReviewedFilesService {
  private readonly reviewedFiles: ReviewedFileStore;

  constructor(reviewedFiles: ReviewedFileStore) {
    this.reviewedFiles = reviewedFiles;
  }

  execute(input: ReconcileReviewedFilesInput): void {
    const { worktreeId } = input;
    const { stale, fresh } = markStaleness(
      this.reviewedFiles.list({ worktreeId }),
      (mark) => mark.path,
      input.fingerprints,
    );
    this.reviewedFiles.setStale({ worktreeId, paths: stale, stale: true });
    this.reviewedFiles.setStale({ worktreeId, paths: fresh, stale: false });
  }
}
