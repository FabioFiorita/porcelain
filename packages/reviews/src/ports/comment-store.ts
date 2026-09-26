import type { WorktreeKey, WorktreeKeys } from '@porcelain/kernel/models';
import type {
  AgentReply,
  CommentMessageKey,
  CommentReply,
  CommentResolution,
  CommentThread,
  CommentThreadKey,
  CommentUsage,
  NewCommentThread,
  PostedCommentMessage,
} from '../models/comment-thread.ts';

export interface CommentStore {
  list(input: WorktreeKey): CommentThread[];
  find(input: CommentThreadKey): CommentThread | undefined;
  findMessage(input: CommentMessageKey): PostedCommentMessage | undefined;
  usage(input: WorktreeKey): CommentUsage;
  lastRevision(input: WorktreeKey): number;
  listAgentReplies(input: WorktreeKeys): AgentReply[];
  insert(input: NewCommentThread): CommentThread;
  append(input: CommentReply): CommentThread;
  resolve(input: CommentResolution): CommentThread;
}
