export interface ChangeLinesReader {
  readHeadLines(
    path: string,
    from: number,
    to: number,
    signal?: AbortSignal,
  ): Promise<string[]>;
  readWorktreeText(path: string, signal?: AbortSignal): Promise<string>;
  confirmReachable(worktreeId: string, signal?: AbortSignal): Promise<void>;
}
