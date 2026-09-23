import type {
  CommentAppend,
  CommentMessage,
  CommentResolution,
  CommentStorage,
  CommentThread,
  CommentUsage,
  PostedCommentMessage,
} from '../../src/models/comment-thread.ts';
import type { CommentStore } from '../../src/ports/comment-store.ts';

type Row = { thread: CommentThread; storage: CommentStorage };

export class InMemoryCommentStore implements CommentStore {
  private readonly rows = new Map<string, Row>();

  list(worktreeId: string): CommentThread[] {
    return [...this.rows.values()]
      .filter((row) => row.thread.worktreeId === worktreeId)
      .map((row) => structuredClone(row.thread));
  }

  find(threadId: string): CommentThread | undefined {
    const row = this.rows.get(threadId);
    return row ? structuredClone(row.thread) : undefined;
  }

  findMessage(messageId: string): PostedCommentMessage | undefined {
    for (const { thread } of this.rows.values()) {
      const message = thread.messages.find((entry) => entry.id === messageId);
      if (message)
        return {
          ...structuredClone(message),
          threadId: thread.id,
          worktreeId: thread.worktreeId,
        };
    }
    return undefined;
  }

  usage(worktreeId: string): CommentUsage {
    const rows = [...this.rows.values()].filter(
      (row) => row.thread.worktreeId === worktreeId,
    );
    return {
      threads: rows.length,
      bytes: rows.reduce((total, row) => total + row.storage.sizeBytes, 0),
    };
  }

  lastRevision(): number {
    return Math.max(
      0,
      ...[...this.rows.values()].map((row) => row.thread.revision),
    );
  }

  lastRevisionIn(worktreeId: string): number {
    return Math.max(
      0,
      ...this.list(worktreeId).map((thread) => thread.revision),
    );
  }

  insert(thread: CommentThread, storage: CommentStorage): void {
    this.rows.set(thread.id, {
      thread: structuredClone(thread),
      storage: { ...storage },
    });
  }

  append(
    _worktreeId: string,
    threadId: string,
    message: CommentMessage,
    change: CommentAppend,
  ): void {
    const row = this.rows.get(threadId);
    if (!row) return;
    row.thread.messages.push(structuredClone(message));
    row.thread.revision = change.revision;
    row.storage = {
      sizeBytes: change.sizeBytes,
      lastAgentRevision: change.lastAgentRevision,
    };
  }

  resolve(threadId: string, change: CommentResolution): void {
    const row = this.rows.get(threadId);
    if (!row) return;
    row.thread.resolved = change.resolved;
    row.thread.revision = change.revision;
    row.storage.sizeBytes = change.sizeBytes;
  }
}
