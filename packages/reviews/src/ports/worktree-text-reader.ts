export interface WorktreeTextReader {
  read(worktreeId: string, path: string, signal?: AbortSignal): Promise<string>;
}
