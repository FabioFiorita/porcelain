export interface WorktreeFingerprintReader {
  all(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ReadonlyMap<string, string | undefined>>;
  selected(
    worktreeId: string,
    paths: readonly string[],
    signal?: AbortSignal,
  ): Promise<ReadonlyMap<string, string>>;
}
