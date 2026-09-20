/**
 * How long each worktree with review data has been gone.
 *
 * Only a listing that *succeeded* may say a worktree is missing, so every
 * method here is about observed absence rather than about what is on disk.
 */
export interface WorktreePresenceStore {
  /** Called with the first review data written for a worktree. */
  record(worktreeId: string, projectId: string): void;
  /**
   * Reconcile one project against a listing that succeeded: present ids have
   * their clock cleared, the rest have it started if it is not already.
   */
  observe(projectId: string, presentIds: string[], at: string): void;
  /** Ids absent since before the given instant, as an ISO timestamp. */
  expired(before: string): string[];
  /** Delete those worktrees' review data, and their rows last. */
  collect(worktreeIds: string[]): void;
}
