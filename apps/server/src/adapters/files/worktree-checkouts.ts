export interface WorktreeCheckouts {
  known(worktreeId: string, signal?: AbortSignal): Promise<{ path: string }>;
}
