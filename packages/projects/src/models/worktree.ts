export interface ListableProject {
  id: string;
  commonDirectory: string;
  repositoryIdentity: string;
}

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
  issues: { path: string; error: unknown }[];
  failure?: unknown;
  complete: boolean;
}
