export type DiscoveredWorktree = {
  path: string;
  metadataIdentity: string | null;
  administrativeDirectory: string;
  main: boolean;
  branch: string | null;
  available: boolean;
};
export type DiscoveredRepository = {
  commonDirectory: string;
  repositoryIdentity: string;
  worktrees: DiscoveredWorktree[];
};
