export interface IgnoredEntriesReader {
  read(
    worktreeId: string,
    paths: readonly string[],
    signal?: AbortSignal,
  ): Promise<ReadonlySet<string>>;
}
