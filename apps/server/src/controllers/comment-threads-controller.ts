import type {
  CommentCommand,
  CommentPrincipal,
  StoredCommentThread,
} from '@porcelain/reviews/models';
import type { CommentThreadsService } from '@porcelain/reviews/services';

type RunForWorktree = <T>(
  operation: (signal: AbortSignal) => T | Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

export class CommentThreadsController {
  private readonly commentThreads: CommentThreadsService;
  private readonly runForWorktree: RunForWorktree;
  private readonly publishCommentsChanged: (worktreeId: string) => void;

  constructor(
    commentThreads: CommentThreadsService,
    runForWorktree: RunForWorktree,
    publishCommentsChanged: (worktreeId: string) => void,
  ) {
    this.commentThreads = commentThreads;
    this.runForWorktree = runForWorktree;
    this.publishCommentsChanged = publishCommentsChanged;
  }

  async execute(
    input: { command: CommentCommand; principal: CommentPrincipal },
    context: { signal?: AbortSignal },
  ): Promise<StoredCommentThread[]> {
    const command = structuredClone(input.command);
    const threads = await this.runForWorktree(
      (signal) => this.commentThreads.execute(command, input.principal, signal),
      context.signal,
    );
    if (command.kind !== 'list')
      this.publishCommentsChanged(command.worktreeId);
    return threads;
  }
}
