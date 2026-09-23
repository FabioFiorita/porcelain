export interface ListableProject {
  id: string;
  commonDirectory: string;
  repositoryIdentity: string;
}

export interface Worktree {
  id: string;
  projectId: string;
  path: string;
  branch: string | undefined;
  main: boolean;
  available: boolean;
  metadataIdentity: string;
  administrativeDirectory: string;
  commonDirectory: string;
  repositoryIdentity: string;
}

export type WorktreeCheck =
  | { outcome: 'found'; worktree: Worktree }
  | { outcome: 'missing' }
  | { outcome: 'unavailable' };
