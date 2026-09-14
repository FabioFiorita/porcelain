import type { ReviewedFileStore } from '../repositories/interfaces/reviewed-file-store.ts';
import { WorktreeNotFoundError } from './errors/worktree-not-found-error.ts';
import type { ListReviewedFiles } from './list-reviewed-files.ts';

export class RemoveReviewedFile {
  private readonly reviewed: ReviewedFileStore;
  private readonly list: ListReviewedFiles;

  constructor(reviewed: ReviewedFileStore, list: ListReviewedFiles) {
    this.reviewed = reviewed;
    this.list = list;
  }

  execute(worktreeId: string, path: string) {
    if (!this.reviewed.hasWorktree(worktreeId))
      throw new WorktreeNotFoundError();
    this.reviewed.remove(worktreeId, path);
    return this.list.execute(worktreeId);
  }
}
