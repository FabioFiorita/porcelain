import { MarkCommentsSeenService } from '@porcelain/reviews/services';

type CommentWorktreeAccess = {
  forWriting(worktreeId: string, signal?: AbortSignal): Promise<unknown>;
};
type RunForWorktree = <T>(
  operation: (signal: AbortSignal) => T | Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

export class MarkCommentsSeenController {
  private readonly worktrees: CommentWorktreeAccess;
  private readonly markCommentsSeen: MarkCommentsSeenService;
  private readonly runForWorktree: RunForWorktree;
  private readonly publishCommentsChanged: (worktreeId: string) => void;

  constructor(
    worktrees: CommentWorktreeAccess,
    markCommentsSeen: MarkCommentsSeenService,
    runForWorktree: RunForWorktree,
    publishCommentsChanged: (worktreeId: string) => void,
  ) {
    this.worktrees = worktrees;
    this.markCommentsSeen = markCommentsSeen;
    this.runForWorktree = runForWorktree;
    this.publishCommentsChanged = publishCommentsChanged;
  }

  async execute(
    input: { worktreeId: string; throughRevision: number },
    context: { signal?: AbortSignal },
  ): Promise<{ worktreeId: string; seenThrough: number }> {
    const result = await this.runForWorktree(async (signal) => {
      await this.worktrees.forWriting(input.worktreeId, signal);
      return this.markCommentsSeen.execute(
        input.worktreeId,
        input.throughRevision,
      );
    }, context.signal);
    this.publishCommentsChanged(input.worktreeId);
    return result;
  }
}
