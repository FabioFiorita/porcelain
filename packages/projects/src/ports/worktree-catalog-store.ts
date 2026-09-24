import type { ListedWorktree } from '../models/listed-worktree.ts';
import type { ListableProject, ProjectKey } from '../models/project.ts';
import type { WorktreeListing } from '../models/worktree-listing.ts';

export interface WorktreeCatalogStore {
  list(input: ListableProject, signal?: AbortSignal): Promise<WorktreeListing>;
  lastSeen(input: ProjectKey): ListedWorktree[];
  remove(input: ProjectKey): void;
}
