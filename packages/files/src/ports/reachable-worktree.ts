export interface ReachableWorktree {
  path: string;
  metadataIdentity: string;
}

export interface ReachableWorktreeReader {
  reachable(id: string, signal?: AbortSignal): Promise<ReachableWorktree>;
}
