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
    const { worktreeId, scope, branch } = input;
    const key = { worktreeId, scope, branch };
    const { marked, conflicts } = selectReviewedFiles(
      input.files,
      input.changes,
    );
    if (input.onConflict === 'refuse' && conflicts.length > 0)
      throw new ReviewedMarkConflictError();
    const evicted = evictedPaths(
      this.reviewedFiles.list(key),
      marked,
      scope === 'branch'
        ? (this.options.marksPerBranch ?? this.options.marksPerWorktree)
        : this.options.marksPerWorktree,
      new Set(input.changes.map((change) => change.path)),
    );
    this.reviewedFiles.remove({ ...key, paths: evicted });
    const reviewedAt = this.clock.now();
    this.reviewedFiles.save({
      ...key,
      marks: marked.map((file) => ({ ...file, reviewedAt, stale: false })),
    });
    return {
      worktreeId,
      marks: reviewedMarks(this.reviewedFiles.list(key)),
      marked: marked.map((file) => file.path),
      conflicts,
      changed: marked.length > 0 || evicted.length > 0,
    };
  }
}
