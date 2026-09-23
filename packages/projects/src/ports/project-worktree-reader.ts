import type { ListableProject } from '../models/worktree.ts';
import type { WorktreeListing } from '../models/worktree-listing.ts';

export interface ProjectWorktreeReader {
  list(
    project: ListableProject,
    signal?: AbortSignal,
  ): Promise<WorktreeListing>;
  forget(projectId: string): void;
}
