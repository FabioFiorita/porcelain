import type {
  ListableProject,
  ProjectListing,
  ResolvedWorktree,
} from '../../models/worktree.ts';

/**
 * Where worktrees come from. Git is the source; nothing stores them.
 *
 * A listing that fails is reported through {@link ProjectListing.failure}
 * rather than thrown, because "this repository could not be read" is an answer
 * the caller has to show, not an error that should abandon the other projects.
 */
export interface WorktreeSource {
  list(project: ListableProject, signal?: AbortSignal): Promise<ProjectListing>;
  listAll(signal?: AbortSignal): Promise<ProjectListing[]>;
  /** Null when nothing by that id is there; throws when nobody could tell. */
  resolve(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ResolvedWorktree | null>;
  /** The repository a known id belongs to, without waiting on Git. */
  repositoryOf(worktreeId: string): string | null;
}
