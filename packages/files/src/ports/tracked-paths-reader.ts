export interface TrackedPathsReader {
  list(
    checkout: string,
    signal?: AbortSignal,
  ): Promise<{ paths: string[]; complete: boolean }>;
}
