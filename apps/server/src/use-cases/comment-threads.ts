import { commentStorageSize } from '../models/comment-storage-size.ts';
import type {
  CommentCommand,
  CommentThread,
} from '../models/comment-thread.ts';
import type { CommentStore } from '../repositories/interfaces/comment-store.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { CommentLimitExceededError } from './errors/comment-limit-exceeded-error.ts';
import { CommentTargetNotFoundError } from './errors/comment-target-not-found-error.ts';
import { WorktreeNotFoundError } from './errors/worktree-not-found-error.ts';
import { validateCommentCommand } from './validate-comment-command.ts';

export class CommentThreads {
  private readonly store: CommentStore;
  private readonly inventory: InventoryStore;
  private readonly newId: () => string;
  constructor(
    store: CommentStore,
    inventory: InventoryStore,
    newId: () => string,
  ) {
    this.store = store;
    this.inventory = inventory;
    this.newId = newId;
  }
  private hasWorktree(worktreeId: string): boolean {
    return this.inventory
      .read()
      .projects.some((project) =>
        project.worktrees.some((worktree) => worktree.id === worktreeId),
      );
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
  execute(command: CommentCommand): CommentThread[] {
    validateCommentCommand(command);
    if (command.kind === 'list') {
      const threads = this.store.list(command.worktreeId);
      if (threads.length === 0 && !this.hasWorktree(command.worktreeId))
        throw new WorktreeNotFoundError();
      return threads;
    }
    if (command.kind === 'create') {
      if (!this.hasWorktree(command.worktreeId))
        throw new CommentTargetNotFoundError();
      const thread: CommentThread = {
        id: this.newId(),
        worktreeId: command.worktreeId,
        anchor: structuredClone(command.anchor),
        resolved: false,
        messages: [{ id: this.newId(), body: command.body }],
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
              { id: this.newId(), body: command.body },
            ],
          }
        : { ...thread, resolved: command.resolved };
    if (command.kind === 'reply') this.assertCapacity(updated, thread);
    this.store.save(updated);
    return [updated];
  }
}
