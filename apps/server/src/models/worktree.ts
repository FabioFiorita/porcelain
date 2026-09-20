import type { DiscoveryIssue } from '@porcelain/git/dtos/discovery-issue';

/** A project as a listing needs it: where it is, not what is in it. */
export interface ListableProject {
  id: string;
  commonDirectory: string;
  repositoryIdentity: string;
}

/** A worktree as Git listed it, with the id derived from its identity. */
export interface ResolvedWorktree {
  id: string;
  projectId: string;
  path: string;
  branch: string | null;
  main: boolean;
  available: boolean;
  metadataIdentity: string;
  administrativeDirectory: string;
  commonDirectory: string;
  repositoryIdentity: string;
}

export interface ProjectListing {
  projectId: string;
  worktrees: ResolvedWorktree[];
  /** What Git could not tell us about individual worktrees. */
  issues: DiscoveryIssue[];
  /** Present when the project could not be listed at all. */
  failure?: unknown;
  /**
   * Whether this is the whole truth about which worktrees exist.
   *
   * A listing can succeed and still be missing one: a worktree Git printed
   * whose identity could not be derived is left out rather than guessed at.
   * Only a complete listing may say that a worktree is gone, because absence
   * is what starts the thirty-day clock on its review data.
   */
  complete: boolean;
}
