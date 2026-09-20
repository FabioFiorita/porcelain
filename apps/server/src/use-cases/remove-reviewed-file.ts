import type { ReviewedFileStore } from '../repositories/interfaces/reviewed-file-store.ts';
import type { ListReviewedFiles } from './list-reviewed-files.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

export class RemoveReviewedFile {
  private readonly reviewed: ReviewedFileStore;
  private readonly worktrees: ResolveWorktree;
  private readonly list: ListReviewedFiles;

  constructor(
    reviewed: ReviewedFileStore,
    worktrees: ResolveWorktree,
    list: ListReviewedFiles,
  ) {
    this.reviewed = reviewed;
    this.worktrees = worktrees;
    this.list = list;
  }

  async execute(worktreeId: string, path: string, signal?: AbortSignal) {
    // Ask before deleting. Listing asks the same question afterwards, but a
    // request that answers "not found" must not have changed anything first.
    await this.worktrees.known(worktreeId, signal);
    this.reviewed.remove(worktreeId, path);
    return this.list.execute(worktreeId, signal);
  }
}
