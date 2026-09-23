import type { ReviewedFilesResult } from '../models/reviewed-file.ts';
import type { ReviewedFileStore } from '../ports/reviewed-file-store.ts';

export class ListReviewedFilesService {
  private readonly reviewed: ReviewedFileStore;

  constructor(reviewed: ReviewedFileStore) {
    this.reviewed = reviewed;
  }

  execute(worktreeId: string): ReviewedFilesResult {
    return { worktreeId, marks: this.reviewed.list(worktreeId) };
  }
}
