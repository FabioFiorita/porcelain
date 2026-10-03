import type {
  AgentReply,
  CommentEdit,
  CommentRemoval,
  CommentReply,
  CommentResolution,
  CommentThread,
  CommentUsage,
  NewCommentThread,
  CommentMessage,
  PostedCommentMessage,
} from '../../src/models/comment-thread.ts';
import type { CommentStore } from '../../src/ports/comment-store.ts';

type Row = {
  thread: CommentThread;
  sizeBytes: number;
  writtenByAgent: boolean;
  agentRevision: number;
};

type Write = Omit<Row, 'thread'>;

export class InMemoryCommentStore implements CommentStore {
  private readonly rows = new Map<string, Row>();
  private readonly replies = new Map<string, readonly CommentMessage[]>();
  private readonly writes = new Map<string, Write>();
  private readonly resolutions = new Map<string, boolean>();
  private readonly revisions = new Map<string, number>();
  private readonly edits = new Map<
    string,
    Pick<CommentMessage, 'body' | 'editedAt'>
  >();
  private readonly removedMessages = new Set<string>();

  list(input: { worktreeId: string }): CommentThread[] {
    return this.stored()
      .filter((row) => row.thread.worktreeId === input.worktreeId)
      .map((row) => structuredClone(row.thread));
  }

  find(input: { threadId: string }): CommentThread | undefined {
    const row = this.rows.get(input.threadId);
    return row && structuredClone(this.current(row).thread);
  }

  findMessage(input: { messageId: string }): PostedCommentMessage | undefined {
    return this.stored()
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
    const rows = this.stored().filter(
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

  listAgentReplies(input: { worktreeIds: readonly string[] }): AgentReply[] {
    return this.stored()
      .filter(
        (row) =>
          row.writtenByAgent &&
          input.worktreeIds.includes(row.thread.worktreeId),
      )
      .map(({ thread, agentRevision }) => ({
        worktreeId: thread.worktreeId,
        threadId: thread.id,
        revision: agentRevision,
        resolved: thread.resolved,
      }));
  }

  insert(input: NewCommentThread): CommentThread {
    const thread: CommentThread = {
      ...structuredClone(input.content),
      resolved: false,
      revision: this.nextRevision(),
    };
    this.rows.set(thread.id, {
      thread,
      sizeBytes: input.sizeBytes,
      writtenByAgent: input.writtenByAgent,
      agentRevision: thread.revision,
    });
    return structuredClone(thread);
  }

  append(input: CommentReply): CommentThread {
    const revision = this.nextRevision();
    const threadId = input.thread.id;
    this.replies.set(threadId, [
      ...(this.replies.get(threadId) ?? []),
      structuredClone(input.message),
    ]);
    this.writes.set(threadId, {
      sizeBytes: input.sizeBytes,
      writtenByAgent: input.writtenByAgent,
      agentRevision: revision,
    });
    this.revisions.set(threadId, revision);
    return structuredClone({
      ...input.thread,
      messages: [...input.thread.messages, input.message],
      revision,
    });
  }

  resolve(input: CommentResolution): CommentThread {
    const revision = this.nextRevision();
    this.resolutions.set(input.thread.id, input.resolved);
    this.revisions.set(input.thread.id, revision);
    return structuredClone({
      ...input.thread,
      resolved: input.resolved,
      revision,
    });
  }

  edit(input: CommentEdit): CommentThread {
    const revision = this.nextRevision();
    const threadId = input.thread.id;
    this.edits.set(input.messageId, {
      body: input.body,
      editedAt: input.editedAt,
    });
    this.writes.set(threadId, {
      ...this.writtenBy(threadId),
      sizeBytes: input.sizeBytes,
    });
    this.revisions.set(threadId, revision);
    return this.find({ threadId }) ?? structuredClone(input.thread);
  }

  removeMessage(input: CommentRemoval): CommentThread {
    const threadId = input.thread.id;
    this.removedMessages.add(input.messageId);
    const revision = this.nextRevision();
    this.writes.set(threadId, {
      ...this.writtenBy(threadId),
      sizeBytes: input.sizeBytes,
    });
    this.revisions.set(threadId, revision);
    return this.find({ threadId }) ?? structuredClone(input.thread);
  }

  remove(input: { threadId: string }): void {
    this.rows.delete(input.threadId);
  }

  private writtenBy(threadId: string): Write {
    const row = this.rows.get(threadId);
    const current = row && this.current(row);
    return {
      sizeBytes: current?.sizeBytes ?? 0,
      writtenByAgent: current?.writtenByAgent ?? false,
      agentRevision: current?.agentRevision ?? 0,
    };
  }

  private stored(): Row[] {
    return [...this.rows.values()].map((row) => this.current(row));
  }

  private current(row: Row): Row {
    const threadId = row.thread.id;
    return {
      ...row,
      ...this.writes.get(threadId),
      thread: {
        ...row.thread,
        messages: [
          ...row.thread.messages,
          ...(this.replies.get(threadId) ?? []),
        ]
          .filter((message) => !this.removedMessages.has(message.id))
          .map((message) => ({ ...message, ...this.edits.get(message.id) })),
        resolved: this.resolutions.get(threadId) ?? row.thread.resolved,
        revision: this.revisions.get(threadId) ?? row.thread.revision,
      },
    };
  }

  private nextRevision(): number {
    return Math.max(0, ...this.stored().map((row) => row.thread.revision)) + 1;
  }
}
