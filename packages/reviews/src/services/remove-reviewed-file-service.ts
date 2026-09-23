import type { ReviewedFilesResult } from '../models/reviewed-file.ts';
import type { ReviewedFileStore } from '../ports/reviewed-file-store.ts';

export class RemoveReviewedFileService {
  private readonly reviewed: ReviewedFileStore;

  constructor(reviewed: ReviewedFileStore) {
    this.reviewed = reviewed;
  }

  execute(worktreeId: string, path: string): ReviewedFilesResult {
    this.reviewed.remove(worktreeId, path);
    return { worktreeId, marks: this.reviewed.list(worktreeId) };
  }
}
