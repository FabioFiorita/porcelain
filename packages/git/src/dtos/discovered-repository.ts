export interface DiscoveredWorktree {
  path: string;
  metadataIdentity: string | null;
  main: boolean;
  branch: string | null;
  available: boolean;
}
export interface DiscoveredRepository {
  commonDirectory: string;
  repositoryIdentity: string;
  worktrees: DiscoveredWorktree[];
}
