import { Effect } from 'effect';
import type {
  ListReviewedFilesInput,
  ListReviewedFilesResult,
} from '../models/list-reviewed-files.ts';
import type { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import { reviewedMarks } from '../rules/reviewed-marks.ts';

export class ListReviewedFilesService {
  private readonly reviewedFiles: ReviewedFileStore;

  constructor(reviewedFiles: ReviewedFileStore) {
    this.reviewedFiles = reviewedFiles;
  }

  execute(
    input: ListReviewedFilesInput,
  ): Effect.Effect<ListReviewedFilesResult, never> {
    return Effect.sync(() => {
      const { worktreeId, scope, branch } = input;
      return {
        worktreeId,
        marks: reviewedMarks(
          this.reviewedFiles.list({ worktreeId, scope, branch }),
        ),
      };
    });
  }
}
