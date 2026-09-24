import type { ForgetProjectWorktreesInput } from '../models/forget-project-worktrees.ts';
import type { WorktreeCatalogStore } from '../ports/worktree-catalog-store.ts';

export class ForgetProjectWorktreesService {
  private readonly worktreeCatalog: WorktreeCatalogStore;

  constructor(worktreeCatalog: WorktreeCatalogStore) {
    this.worktreeCatalog = worktreeCatalog;
  }

  execute(input: ForgetProjectWorktreesInput): void {
    this.worktreeCatalog.remove({ projectId: input.projectId });
  }
}
