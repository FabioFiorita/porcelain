import type {
  CommentAuthor,
  CommentCommand,
  CommentThread,
  StoredCommentThread,
} from '../models/comment-thread.ts';
import type { AuthenticatedPrincipal } from '../models/principal.ts';
import type { CommentStore } from '../repositories/interfaces/comment-store.ts';
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
  private async assertWorktree(worktreeId: string, signal?: AbortSignal) {
    await this.worktrees.known(worktreeId, signal);
  }
  async list(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<StoredCommentThread[]> {
    await this.assertWorktree(worktreeId, signal);
    return this.store.list(worktreeId);
  }
  async execute(
    command: CommentCommand,
    principal: AuthenticatedPrincipal,
    signal?: AbortSignal,
  ): Promise<StoredCommentThread[]> {
    validateCommentCommand(command);
    if (command.kind === 'list') return this.list(command.worktreeId, signal);
    await this.worktrees.forWriting(command.worktreeId, signal);
    if (command.kind === 'create') {
      const thread: CommentThread = {
        id: command.threadId ?? this.newId(),
        worktreeId: command.worktreeId,
        anchor: structuredClone(command.anchor),
        resolved: false,
        messages: [
          {
            id: command.messageId ?? this.newId(),
            body: command.body,
            author: authorFor(principal),
            createdAt: this.now(),
          },
        ],
      };
      return [this.store.create(thread)];
    }
    const updated =
      command.kind === 'reply'
        ? this.store.reply(command.worktreeId, command.threadId, {
            id: command.messageId ?? this.newId(),
            body: command.body,
            author: authorFor(principal),
            createdAt: this.now(),
          })
        : this.store.resolve(
            command.worktreeId,
            command.threadId,
            command.resolved,
          );
    if (!updated) throw new CommentTargetNotFoundError();
    return [updated];
  }
}

function authorFor(principal: AuthenticatedPrincipal): CommentAuthor {
  switch (principal.kind) {
    case 'agent':
      return 'agent';
    case 'owner':
    case 'viewer':
      return 'reviewer';
  }
}
