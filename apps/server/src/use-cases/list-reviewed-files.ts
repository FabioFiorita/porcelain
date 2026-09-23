import type { ReviewedFileStore } from '../repositories/interfaces/reviewed-file-store.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

export class ListReviewedFiles {
  private readonly reviewed: ReviewedFileStore;
  private readonly worktrees: ResolveWorktree;

  constructor(reviewed: ReviewedFileStore, worktrees: ResolveWorktree) {
    this.reviewed = reviewed;
    this.worktrees = worktrees;
  }

  async execute(worktreeId: string, signal?: AbortSignal) {
    await this.worktrees.known(worktreeId, signal);
    return { worktreeId, marks: this.reviewed.list(worktreeId) };
  }
}
