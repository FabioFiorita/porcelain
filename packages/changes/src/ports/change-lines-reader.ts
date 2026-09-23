export interface ChangeLinesReader {
  readHeadText(
    worktreeId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<string>;
  readWorktreeText(
    worktreeId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<string>;
}
