import type {
  ReconcileReviewedFilesInput,
  ReconcileReviewedFilesResult,
} from '../models/reviewed-mark.ts';
import type { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import { staleness } from '../rules/reviewed-marks.ts';

export class ReconcileReviewedFilesService {
  private readonly reviewedFileStore: ReviewedFileStore;

  constructor(reviewedFileStore: ReviewedFileStore) {
    this.reviewedFileStore = reviewedFileStore;
  }

  execute(input: ReconcileReviewedFilesInput): ReconcileReviewedFilesResult {
    const { stale, fresh } = staleness(
      this.reviewedFileStore.list(input.worktreeId),
      input.fingerprints,
    );
    if (stale.length > 0)
      this.reviewedFileStore.setStale(input.worktreeId, stale, true);
    if (fresh.length > 0)
      this.reviewedFileStore.setStale(input.worktreeId, fresh, false);
  }
}
