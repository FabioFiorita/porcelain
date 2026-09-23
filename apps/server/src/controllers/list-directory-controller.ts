import type { DirectoryResponse } from '@porcelain/contracts/files';

type ListDirectory = {
  execute(
    worktreeId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<DirectoryResponse>;
};
type RunWorktreeRead = <T>(
  worktreeId: string,
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

export class ListDirectoryController {
  private readonly listDirectory: ListDirectory;
  private readonly runWorktreeRead: RunWorktreeRead;

  constructor(listDirectory: ListDirectory, runWorktreeRead: RunWorktreeRead) {
    this.listDirectory = listDirectory;
    this.runWorktreeRead = runWorktreeRead;
  }

  execute(
    input: { worktreeId: string; path: string },
    context: { signal?: AbortSignal },
  ): Promise<DirectoryResponse> {
    return this.runWorktreeRead(
      input.worktreeId,
      (signal) =>
        this.listDirectory.execute(input.worktreeId, input.path, signal),
      context.signal,
    );
  }
}
