import type { Clock } from '@porcelain/kernel/ports';
import { ReviewedMarkConflictError } from '../errors/reviewed-mark-conflict-error.ts';

import type {
  SetReviewedFilesInput,
  SetReviewedFilesOptions,
  SetReviewedFilesResult,
} from '../models/set-reviewed-files.ts';
import type { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import {
  evictedPaths,
  reviewedMarks,
  selectReviewedFiles,
} from '../rules/reviewed-marks.ts';

export class SetReviewedFilesService {
  private readonly reviewedFiles: ReviewedFileStore;
  private readonly clock: Clock;
  private readonly options: SetReviewedFilesOptions;

  constructor(
    reviewedFiles: ReviewedFileStore,
    clock: Clock,
    options: SetReviewedFilesOptions,
  ) {
    this.reviewedFiles = reviewedFiles;
    this.clock = clock;
    this.options = options;
  }

  execute(input: SetReviewedFilesInput): SetReviewedFilesResult {
    const { worktreeId } = input;
    const { marked, conflicts } = selectReviewedFiles(
      input.files,
      input.changes,
    );
    if (input.onConflict === 'refuse' && conflicts.length > 0)
      throw new ReviewedMarkConflictError();
    this.reviewedFiles.remove({
      worktreeId,
      paths: evictedPaths(
        this.reviewedFiles.list({ worktreeId }),
        marked,
        this.options.marksPerWorktree,
      ),
    });
    const reviewedAt = this.clock.now();
    this.reviewedFiles.save({
      worktreeId,
      marks: marked.map((file) => ({ ...file, reviewedAt, stale: false })),
    });
    return {
      worktreeId,
      marks: reviewedMarks(this.reviewedFiles.list({ worktreeId })),
      marked: marked.map((file) => file.path),
      conflicts,
    };
  }
}
