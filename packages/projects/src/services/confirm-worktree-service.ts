import { WorktreeChangedError } from '@porcelain/kernel/errors';
import type { ConfirmWorktreeInput } from '../models/check-worktree.ts';
import type { WorktreeCatalogStore } from '../ports/worktree-catalog-store.ts';
import { sameWorktree } from '../rules/same-worktree.ts';

export class ConfirmWorktreeService {
  private readonly catalog: WorktreeCatalogStore;

  constructor(catalog: WorktreeCatalogStore) {
    this.catalog = catalog;
  }

  execute(input: ConfirmWorktreeInput): void {
    const current = this.catalog.find({ worktreeId: input.worktree.id });
    if (!sameWorktree(input.worktree, current?.worktree))
      throw new WorktreeChangedError();
  }
}
