import type {
  ListKnownWorktreesInput,
  ListKnownWorktreesResult,
} from '../models/list-known-worktrees.ts';
import type { WorktreeCatalogStore } from '../ports/worktree-catalog-store.ts';
import { unavailableWorktrees } from '../rules/unavailable-worktrees.ts';

export class ListKnownWorktreesService {
  private readonly worktreeCatalog: WorktreeCatalogStore;

  constructor(worktreeCatalog: WorktreeCatalogStore) {
    this.worktreeCatalog = worktreeCatalog;
  }

  execute(input: ListKnownWorktreesInput): ListKnownWorktreesResult {
    return {
      listings: input.projects.map((project) => {
        const worktrees = this.worktreeCatalog.lastSeen({
          projectId: project.id,
        });
        return {
          projectId: project.id,
          available: project.available,
          worktrees: project.available
            ? worktrees
            : unavailableWorktrees(worktrees),
        };
      }),
    };
  }
}
