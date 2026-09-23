import type { ReconcileReviewedFilesInput } from '../models/operation-inputs.ts';
import type { ReviewedFileStore } from '../ports/reviewed-file-store.ts';

export class ReconcileReviewedFilesService {
  private readonly reviewedFileStore: ReviewedFileStore;

  constructor(reviewedFileStore: ReviewedFileStore) {
    this.reviewedFileStore = reviewedFileStore;
  }

  execute(input: ReconcileReviewedFilesInput): void {
    this.reviewedFileStore.reconcile(
      input.worktreeId,
      new Map(
        input.changes.flatMap(({ path, fingerprint }) =>
          fingerprint === undefined ? [] : [[path, fingerprint] as const],
        ),
      ),
    );
  }
}
