import type { ReviewedFilesResult } from '@porcelain/reviews/models';
import type { RemoveReviewedFileService } from '@porcelain/reviews/services';

type WorktreeAccess = {
  known(worktreeId: string, signal?: AbortSignal): Promise<unknown>;
};
type RunForWorktree = <T>(
  operation: (signal: AbortSignal) => T | Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

export class RemoveReviewedFileController {
  private readonly worktrees: WorktreeAccess;
  private readonly removeReviewedFile: RemoveReviewedFileService;
  private readonly runForWorktree: RunForWorktree;
  private readonly publishReviewedChanged: (worktreeId: string) => void;

  constructor(
    worktrees: WorktreeAccess,
    removeReviewedFile: RemoveReviewedFileService,
    runForWorktree: RunForWorktree,
    publishReviewedChanged: (worktreeId: string) => void,
  ) {
    this.worktrees = worktrees;
    this.removeReviewedFile = removeReviewedFile;
    this.runForWorktree = runForWorktree;
    this.publishReviewedChanged = publishReviewedChanged;
  }

  async execute(
    input: { worktreeId: string; path: string },
    context: { signal?: AbortSignal },
  ): Promise<ReviewedFilesResult> {
    const result = await this.runForWorktree(async (signal) => {
      await this.worktrees.known(input.worktreeId, signal);
      return this.removeReviewedFile.execute(input.worktreeId, input.path);
    }, context.signal);
    this.publishReviewedChanged(input.worktreeId);
    return result;
  }
}
