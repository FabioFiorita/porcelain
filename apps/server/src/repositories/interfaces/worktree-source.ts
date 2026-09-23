import type {
  ListableProject,
  ProjectListing,
  ResolvedWorktree,
} from '../../models/worktree.ts';

export interface WorktreeSource {
  list(project: ListableProject, signal?: AbortSignal): Promise<ProjectListing>;
  listAll(signal?: AbortSignal): Promise<ProjectListing[]>;
  resolve(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ResolvedWorktree | null>;
  repositoryOf(worktreeId: string): string | null;
}
