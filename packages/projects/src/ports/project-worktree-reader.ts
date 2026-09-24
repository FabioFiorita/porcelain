import type { WorktreeListing } from '../models/worktree-listing.ts';
import type { ListableProject } from '../models/project.ts';

export interface ProjectWorktreeReader {
  list(
    project: ListableProject,
    signal?: AbortSignal,
  ): Promise<WorktreeListing>;
  forget(projectId: string): void;
}
