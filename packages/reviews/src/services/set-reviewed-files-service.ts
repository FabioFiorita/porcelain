import type { Clock } from '@porcelain/kernel/ports';
import { ReviewedMarkConflictError } from '../errors/reviewed-mark-conflict-error.ts';
import type {
  SetReviewedFilesInput,
  SetReviewedFilesResult,
} from '../models/reviewed-mark.ts';
import type { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import {
  evictionCount,
  reviewedMarks,
  selectReviewedFiles,
} from '../rules/reviewed-marks.ts';

export class SetReviewedFilesService {
  private readonly reviewedFileStore: ReviewedFileStore;
  private readonly clock: Clock;

  constructor(reviewedFileStore: ReviewedFileStore, clock: Clock) {
    this.reviewedFileStore = reviewedFileStore;
    this.clock = clock;
  }

  execute(input: SetReviewedFilesInput): SetReviewedFilesResult {
    const { worktreeId } = input;
    const selection = selectReviewedFiles(input.files, input.changes);
    if (input.onConflict === 'refuse' && selection.conflicts.length > 0)
      throw new ReviewedMarkConflictError();
    const reviewedAt = this.clock.now();
    for (const file of selection.marked) {
      if (!this.reviewedFileStore.find(worktreeId, file.path)) {
        const evicted = evictionCount(this.reviewedFileStore.count(worktreeId));
        if (evicted > 0)
          this.reviewedFileStore.remove(
            worktreeId,
            this.reviewedFileStore.oldest(worktreeId, evicted),
          );
      }
      this.reviewedFileStore.save(worktreeId, {
        ...file,
        reviewedAt,
        stale: false,
      });
    }
    return {
      worktreeId,
      marks: reviewedMarks(this.reviewedFileStore.list(worktreeId)),
      marked: selection.marked.map((file) => file.path),
      conflicts: selection.conflicts,
    };
  }
}
