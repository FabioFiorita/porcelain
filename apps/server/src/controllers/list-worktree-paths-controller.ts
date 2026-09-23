import type { ListWorktreePathsResponse } from '@porcelain/contracts/files';
import type { ListWorktreePathsService } from '@porcelain/files/services';
type RunWorktreeRead = <T>(
  worktreeId: string,
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

export class ListWorktreePathsController {
  private readonly listWorktreePaths: ListWorktreePathsService;
  private readonly runWorktreeRead: RunWorktreeRead;

  constructor(
    listWorktreePaths: ListWorktreePathsService,
    runWorktreeRead: RunWorktreeRead,
  ) {
    this.listWorktreePaths = listWorktreePaths;
    this.runWorktreeRead = runWorktreeRead;
  }

  execute(
    input: { worktreeId: string },
    context: { signal?: AbortSignal },
  ): Promise<ListWorktreePathsResponse> {
    return this.runWorktreeRead(
      input.worktreeId,
      (signal) => this.listWorktreePaths.execute(input.worktreeId, signal),
      context.signal,
    );
  }
}
