import type {
  AgentReply,
  CommentReply,
  CommentResolution,
  CommentThread,
  CommentUsage,
  NewCommentThread,
  PostedCommentMessage,
} from '../../src/models/comment-thread.ts';
import type { CommentStore } from '../../src/ports/comment-store.ts';

type Row = {
  thread: CommentThread;
  sizeBytes: number;
  agentRevision: number | undefined;
};

export class InMemoryCommentStore implements CommentStore {
  private rows: Row[] = [];

  list(input: { worktreeId: string }): CommentThread[] {
    return this.rows
      .filter((row) => row.thread.worktreeId === input.worktreeId)
      .map((row) => structuredClone(row.thread));
  }

  find(input: { threadId: string }): CommentThread | undefined {
    const row = this.rows.find((entry) => entry.thread.id === input.threadId);
    return row && structuredClone(row.thread);
  }

  findMessage(input: { messageId: string }): PostedCommentMessage | undefined {
    return this.rows
      .flatMap(({ thread }) =>
        thread.messages
          .filter((message) => message.id === input.messageId)
          .map((message) => ({
            ...structuredClone(message),
            threadId: thread.id,
            worktreeId: thread.worktreeId,
          })),
      )
      .at(0);
  }

  usage(input: { worktreeId: string }): CommentUsage {
    const rows = this.rows.filter(
      (row) => row.thread.worktreeId === input.worktreeId,
    );
    return {
      threads: rows.length,
      bytes: rows.reduce((total, row) => total + row.sizeBytes, 0),
    };
  }

  lastRevision(input: { worktreeId: string }): number {
    return Math.max(0, ...this.list(input).map((thread) => thread.revision));
  }

  agentRepliesByWorktrees(input: {
    worktreeIds: readonly string[];
  }): AgentReply[] {
    return this.rows.flatMap(({ thread, agentRevision }) =>
      agentRevision !== undefined &&
      input.worktreeIds.includes(thread.worktreeId)
        ? [
            {
              worktreeId: thread.worktreeId,
              threadId: thread.id,
              revision: agentRevision,
            },
          ]
        : [],
    );
  }

  insert(input: NewCommentThread): CommentThread {
    const thread: CommentThread = {
      ...structuredClone(input.content),
      resolved: false,
      revision: this.nextRevision(),
    };
    this.rows = [
      ...this.rows,
      {
        thread,
        sizeBytes: input.sizeBytes,
        agentRevision: input.writtenByAgent ? thread.revision : undefined,
      },
    ];
    return structuredClone(thread);
  }

  append(input: CommentReply): CommentThread {
    const revision = this.nextRevision();
    return this.replace(
      {
        ...input.thread,
        messages: [...input.thread.messages, input.message],
        revision,
      },
      input.sizeBytes,
      input.writtenByAgent ? revision : undefined,
    );
  }

  resolve(input: CommentResolution): CommentThread {
    const row = this.rows.find((entry) => entry.thread.id === input.thread.id);
    return this.replace(
      {
        ...input.thread,
        resolved: input.resolved,
        revision: this.nextRevision(),
      },
      row?.sizeBytes ?? 0,
      row?.agentRevision,
    );
  }

  private nextRevision(): number {
    return Math.max(0, ...this.rows.map((row) => row.thread.revision)) + 1;
  }

  private replace(
    thread: CommentThread,
    sizeBytes: number,
    agentRevision: number | undefined,
  ): CommentThread {
    this.rows = this.rows.map((row) =>
      row.thread.id === thread.id
        ? { thread: structuredClone(thread), sizeBytes, agentRevision }
        : row,
    );
    return structuredClone(thread);
  }
}
