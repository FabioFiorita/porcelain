import type { ReviewedFilesResult } from '@porcelain/reviews/models';
import type { ListReviewedFilesService } from '@porcelain/reviews/services';

type WorktreeAccess = {
  known(worktreeId: string, signal?: AbortSignal): Promise<unknown>;
};
type RunForWorktree = <T>(
  operation: (signal: AbortSignal) => T | Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

export class ListReviewedFilesController {
  private readonly worktrees: WorktreeAccess;
  private readonly listReviewedFiles: ListReviewedFilesService;
  private readonly runForWorktree: RunForWorktree;

  constructor(
    worktrees: WorktreeAccess,
    listReviewedFiles: ListReviewedFilesService,
    runForWorktree: RunForWorktree,
  ) {
    this.worktrees = worktrees;
    this.listReviewedFiles = listReviewedFiles;
    this.runForWorktree = runForWorktree;
  }

  execute(
    input: { worktreeId: string },
    context: { signal?: AbortSignal },
  ): Promise<ReviewedFilesResult> {
    return this.runForWorktree(async (signal) => {
      await this.worktrees.known(input.worktreeId, signal);
      return this.listReviewedFiles.execute(input.worktreeId);
    }, context.signal);
  }
}
