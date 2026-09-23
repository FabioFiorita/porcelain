import type { ReadTextFileResponse } from '@porcelain/contracts/files';

type ReadTextFile = {
  execute(
    worktreeId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<ReadTextFileResponse>;
};
type RunWorktreeRead = <T>(
  worktreeId: string,
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

export class ReadTextFileController {
  private readonly readTextFile: ReadTextFile;
  private readonly runWorktreeRead: RunWorktreeRead;

  constructor(readTextFile: ReadTextFile, runWorktreeRead: RunWorktreeRead) {
    this.readTextFile = readTextFile;
    this.runWorktreeRead = runWorktreeRead;
  }

  execute(
    input: { worktreeId: string; path: string },
    context: { signal?: AbortSignal },
  ): Promise<ReadTextFileResponse> {
    return this.runWorktreeRead(
      input.worktreeId,
      (signal) =>
        this.readTextFile.execute(input.worktreeId, input.path, signal),
      context.signal,
    );
  }
}
