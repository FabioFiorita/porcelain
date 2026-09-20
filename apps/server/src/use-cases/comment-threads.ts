import { commentStorageSize } from '../models/comment-storage-size.ts';
import type {
  CommentAuthor,
  CommentCommand,
  CommentThread,
} from '../models/comment-thread.ts';
import type { AuthenticatedPrincipal } from '../models/principal.ts';
import type { CommentStore } from '../repositories/interfaces/comment-store.ts';
import { CommentLimitExceededError } from './errors/comment-limit-exceeded-error.ts';
import { CommentTargetNotFoundError } from './errors/comment-target-not-found-error.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';
import { validateCommentCommand } from './validate-comment-command.ts';

export class CommentThreads {
  private readonly store: CommentStore;
  private readonly worktrees: ResolveWorktree;
  private readonly newId: () => string;
  private readonly now: () => string;
  constructor(
    store: CommentStore,
    worktrees: ResolveWorktree,
    newId: () => string,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.store = store;
    this.worktrees = worktrees;
    this.newId = newId;
    this.now = now;
  }
  /**
   * The same question everything else asks. It used to be skipped whenever the
   * worktree already had threads, so comments could disagree with marks about
   * whether a worktree was there.
   */
  private async assertWorktree(worktreeId: string, signal?: AbortSignal) {
    await this.worktrees.known(worktreeId, signal);
  }
  private assertCapacity(next: CommentThread, previous?: CommentThread): void {
    const usage = this.store.usage(next.worktreeId);
    if (
      (!previous && usage.threads >= 100) ||
      next.messages.length > 100 ||
      usage.bytes -
        (previous ? commentStorageSize(previous) : 0) +
        commentStorageSize(next) >
        1048576
    )
      throw new CommentLimitExceededError();
  }
  /** Reading threads has no author, so it needs no principal. */
  async list(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<CommentThread[]> {
    await this.assertWorktree(worktreeId, signal);
    return this.store.list(worktreeId);
  }
  async execute(
    command: CommentCommand,
    principal: AuthenticatedPrincipal,
    signal?: AbortSignal,
  ): Promise<CommentThread[]> {
    validateCommentCommand(command);
    if (command.kind === 'list') return this.list(command.worktreeId, signal);
    // A write: the worktree is recorded as present before anything is stored.
    await this.worktrees.forWriting(command.worktreeId, signal);
    if (command.kind === 'create') {
      const thread: CommentThread = {
        id: this.newId(),
        worktreeId: command.worktreeId,
        anchor: structuredClone(command.anchor),
        resolved: false,
        messages: [
          {
            id: this.newId(),
            body: command.body,
            author: authorFor(principal),
            createdAt: this.now(),
          },
        ],
      };
      this.assertCapacity(thread);
      this.store.save(thread);
      return [thread];
    }
    const thread = this.store.find(command.worktreeId, command.threadId);
    if (!thread) throw new CommentTargetNotFoundError();
    const updated =
      command.kind === 'reply'
        ? {
            ...thread,
            messages: [
              ...thread.messages,
              {
                id: this.newId(),
                body: command.body,
                author: authorFor(principal),
                createdAt: this.now(),
              },
            ],
          }
        : { ...thread, resolved: command.resolved };
    if (command.kind === 'reply') this.assertCapacity(updated, thread);
    this.store.save(updated);
    return [updated];
  }
}

/**
 * Authorship is the door the caller came through, decided here rather than in
 * a route: a transport that could name its own author would make the principal
 * decorative.
 */
function authorFor(principal: AuthenticatedPrincipal): CommentAuthor {
  switch (principal.kind) {
    case 'agent':
      return 'agent';
    case 'owner':
    case 'viewer':
      return 'reviewer';
  }
}
