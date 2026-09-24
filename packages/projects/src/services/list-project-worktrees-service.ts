import type {
  ListProjectWorktreesInput,
  ListProjectWorktreesResult,
} from '../models/list-project-worktrees.ts';
import type { WorktreeCatalogStore } from '../ports/worktree-catalog-store.ts';
import { unavailableWorktrees } from '../rules/unavailable-worktrees.ts';

export class ListProjectWorktreesService {
  private readonly worktreeCatalog: WorktreeCatalogStore;

  constructor(worktreeCatalog: WorktreeCatalogStore) {
    this.worktreeCatalog = worktreeCatalog;
  }

  async execute(
    input: ListProjectWorktreesInput,
    signal?: AbortSignal,
  ): Promise<ListProjectWorktreesResult> {
    const listing = await this.worktreeCatalog.list(input.project, signal);
    if (listing.kind === 'listed')
      return {
        projectId: listing.projectId,
        available: true,
        complete: listing.unidentified === 0,
        worktrees: listing.worktrees,
      };
    return {
      projectId: listing.projectId,
      available: false,
      complete: false,
      worktrees: unavailableWorktrees(
        this.worktreeCatalog.lastSeen({ projectId: listing.projectId }),
      ),
    };
  }
}
