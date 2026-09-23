import type { ListDirectoryResponse } from '@porcelain/contracts/files';

type ListDirectory = {
  execute(
    worktreeId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<ListDirectoryResponse>;
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
  ): Promise<ListDirectoryResponse> {
    return this.runWorktreeRead(
      input.worktreeId,
      (signal) =>
        this.listDirectory.execute(input.worktreeId, input.path, signal),
      context.signal,
    );
  }
}
