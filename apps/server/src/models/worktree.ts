import type { DiscoveryIssue } from '@porcelain/git/dtos/discovery-issue';

/** A project as a listing needs it: where it is, not what is in it. */
export interface ListableProject {
  id: string;
  commonDirectory: string;
  repositoryIdentity: string;
}

/**
 * What the sidebar has to say about a worktree, by meaning rather than by
 * appearance: how it is drawn is the web's business, so the palette can change
 * without touching the server.
 *
 * `pending`: published layers with something in them still unreviewed.
 * `reviewed`: published layers where every file named in them is marked —
 *   waiting for a commit. It means "everything marked, as of when it was
 *   marked": computed from marks alone, it cannot notice the agent editing a
 *   file that was already marked, and buying that knowledge would cost a
 *   status read per worktree, which is what this dot replaced.
 * `replied`: the agent answered a comment the owner has not seen. It outranks
 *   both, being newer and addressed to them.
 * Absent: nothing published. Both layer states end when a commit archives the
 * layers.
 */
export type WorktreeStatus = 'pending' | 'reviewed' | 'replied';

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
