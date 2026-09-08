export interface Worktree {
  id: string;
  path: string;
  metadataIdentity: string | null;
  main: boolean;
  branch: string | null;
  available: boolean;
}
