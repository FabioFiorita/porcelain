import type { ListedWorktree } from '../../src/models/listed-worktree.ts';
import type { ListableProject, ProjectKey } from '../../src/models/project.ts';
import type { WorktreeListing } from '../../src/models/worktree-listing.ts';
import type { WorktreeCatalogStore } from '../../src/ports/worktree-catalog-store.ts';

export class ScriptedWorktreeCatalogStore implements WorktreeCatalogStore {
  private readonly listings = new Map<string, WorktreeListing>();
  private readonly seen = new Map<string, ListedWorktree[]>();

  answer(listing: WorktreeListing): void {
    this.listings.set(listing.projectId, listing);
  }

  saw(projectId: string, worktrees: ListedWorktree[]): void {
    this.seen.set(projectId, worktrees);
  }

  async list(input: ListableProject): Promise<WorktreeListing> {
    return (
      this.listings.get(input.id) ?? {
        kind: 'unavailable',
        projectId: input.id,
      }
    );
  }

  lastSeen(input: ProjectKey): ListedWorktree[] {
    return [...(this.seen.get(input.projectId) ?? [])];
  }

  remove(input: ProjectKey): void {
    this.seen.delete(input.projectId);
  }
}
