import type { ReviewedFileStore } from '../repositories/interfaces/reviewed-file-store.ts';
import { WorktreeNotFoundError } from './errors/worktree-not-found-error.ts';

export class ListReviewedFiles {
  private readonly reviewed: ReviewedFileStore;

  constructor(reviewed: ReviewedFileStore) {
    this.reviewed = reviewed;
  }

  execute(worktreeId: string) {
    this.assertKnownWorktree(worktreeId);
    return { worktreeId, marks: this.reviewed.list(worktreeId) };
  }

  private assertKnownWorktree(worktreeId: string) {
    if (!this.reviewed.hasWorktree(worktreeId))
      throw new WorktreeNotFoundError();
  }
}
