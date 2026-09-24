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
  writtenByAgent: boolean;
  agentRevision: number;
};

export class InMemoryCommentStore implements CommentStore {
  private readonly rows = new Map<string, Row>();

  list(input: { worktreeId: string }): CommentThread[] {
    return this.stored()
      .filter((row) => row.thread.worktreeId === input.worktreeId)
      .map((row) => structuredClone(row.thread));
  }

  find(input: { threadId: string }): CommentThread | undefined {
    return structuredClone(this.rows.get(input.threadId)?.thread);
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
    this.change(input.thread.id, (row) => ({
      thread: {
        ...row.thread,
        messages: [...row.thread.messages, structuredClone(input.message)],
        revision,
      },
      sizeBytes: input.sizeBytes,
      writtenByAgent: input.writtenByAgent,
      agentRevision: revision,
    }));
    return structuredClone({
      ...input.thread,
      messages: [...input.thread.messages, input.message],
      revision,
    });
  }

  resolve(input: CommentResolution): CommentThread {
    const revision = this.nextRevision();
    this.change(input.thread.id, (row) => ({
      ...row,
      thread: { ...row.thread, resolved: input.resolved, revision },
    }));
    return structuredClone({
      ...input.thread,
      resolved: input.resolved,
      revision,
    });
  }

  private stored(): Row[] {
    return [...this.rows.values()];
  }

  private nextRevision(): number {
    return Math.max(0, ...this.stored().map((row) => row.thread.revision)) + 1;
  }

  private change(threadId: string, update: (row: Row) => Row): void {
    this.stored()
      .filter((row) => row.thread.id === threadId)
      .forEach((row) => this.rows.set(threadId, update(row)));
  }
}
