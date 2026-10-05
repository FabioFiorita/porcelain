import { Context } from 'effect';
import { type WorktreeKey, type WorktreeKeys } from '@porcelain/kernel/models';
import {
  type AgentReply,
  type CommentEdit,
  type CommentMessageKey,
  type CommentRemoval,
  type CommentReply,
  type CommentResolution,
  type CommentThread,
  type CommentThreadKey,
  type CommentUsage,
  type NewCommentThread,
  type PostedCommentMessage,
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
  edit(input: CommentEdit): CommentThread;
  removeMessage(input: CommentRemoval): CommentThread;
  remove(input: CommentThreadKey): void;
}

export const CommentStore = Context.Service<
  '@porcelain/reviews/CommentStore',
  CommentStore
>('@porcelain/reviews/CommentStore');
