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
    const { worktreeId, scope } = input;
    const { marked, conflicts } = selectReviewedFiles(
      input.files,
      input.changes,
    );
    if (input.onConflict === 'refuse' && conflicts.length > 0)
      throw new ReviewedMarkConflictError();
    const evicted = evictedPaths(
      this.reviewedFiles.list({ worktreeId, scope }),
      marked,
      this.options.marksPerWorktree,
    );
    this.reviewedFiles.remove({ worktreeId, scope, paths: evicted });
    const reviewedAt = this.clock.now();
    this.reviewedFiles.save({
      worktreeId,
      scope,
      marks: marked.map((file) => ({ ...file, reviewedAt, stale: false })),
    });
    return {
      worktreeId,
      marks: reviewedMarks(this.reviewedFiles.list({ worktreeId, scope })),
      marked: marked.map((file) => file.path),
      conflicts,
      changed: marked.length > 0 || evicted.length > 0,
    };
  }
}
