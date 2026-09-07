export interface Worktree {
  id: string;
  path: string;
  metadataIdentity: string;
  main: boolean;
  branch: string | null;
  available: boolean;
}
