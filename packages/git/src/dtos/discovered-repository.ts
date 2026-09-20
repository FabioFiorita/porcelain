export interface DiscoveredWorktree {
  path: string;
  metadataIdentity: string | null;
  /**
   * The worktree's administrative directory under the repository's common Git
   * directory — `<common>/worktrees/<name>` for a linked worktree, the common
   * directory itself for the main one.
   *
   * Identity comes from here rather than from the checkout, because this stays
   * readable when the checkout does not. An unplugged external worktree is
   * exactly when identity has to survive.
   */
  administrativeDirectory: string;
  main: boolean;
  branch: string | null;
  available: boolean;
}
export interface DiscoveredRepository {
  commonDirectory: string;
  repositoryIdentity: string;
  worktrees: DiscoveredWorktree[];
}
