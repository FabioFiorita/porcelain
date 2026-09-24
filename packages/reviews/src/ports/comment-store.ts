import type {
  AgentReply,
  CommentReply,
  CommentResolution,
  CommentThread,
  CommentUsage,
  NewCommentThread,
  PostedCommentMessage,
} from '../models/comment-thread.ts';

export interface CommentStore {
  list(input: { worktreeId: string }): CommentThread[];
  find(input: { threadId: string }): CommentThread | undefined;
  findMessage(input: { messageId: string }): PostedCommentMessage | undefined;
  usage(input: { worktreeId: string }): CommentUsage;
  lastRevision(input: { worktreeId: string }): number;
  agentRepliesByWorktrees(input: {
    worktreeIds: readonly string[];
  }): AgentReply[];
  insert(input: NewCommentThread): CommentThread;
  append(input: CommentReply): CommentThread;
  resolve(input: CommentResolution): CommentThread;
}
