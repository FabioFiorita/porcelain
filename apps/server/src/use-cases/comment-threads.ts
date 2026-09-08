import type {
  CommentCommand,
  CommentThread,
} from '../models/comment-thread.ts';
import type { CommentStore } from '../repositories/interfaces/comment-store.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { CommentTargetNotFoundError } from './errors/comment-target-not-found-error.ts';

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
  execute(command: CommentCommand): CommentThread[] {
    const threads = this.store.list(command.worktreeId);
    if (command.kind === 'list') return threads;
    if (command.kind === 'create') {
      if (
        !this.inventory
          .read()
          .projects.some((project) =>
            project.worktrees.some(
              (worktree) => worktree.id === command.worktreeId,
            ),
          )
      )
        throw new CommentTargetNotFoundError();
      const thread: CommentThread = {
        id: this.newId(),
        worktreeId: command.worktreeId,
        anchor: structuredClone(command.anchor),
        resolved: false,
        messages: [{ id: this.newId(), body: command.body }],
      };
      this.store.save(thread);
      return [thread];
    }
    const thread = threads.find((entry) => entry.id === command.threadId);
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
    this.store.save(updated);
    return [updated];
  }
}
