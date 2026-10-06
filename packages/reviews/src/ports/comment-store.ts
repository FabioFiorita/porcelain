import type { Effect } from 'effect';
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
  list(input: WorktreeKey): Effect.Effect<CommentThread[]>;
  find(input: CommentThreadKey): Effect.Effect<CommentThread | undefined>;
  findMessage(
    input: CommentMessageKey,
  ): Effect.Effect<PostedCommentMessage | undefined>;
  usage(input: WorktreeKey): Effect.Effect<CommentUsage>;
  lastRevision(input: WorktreeKey): Effect.Effect<number>;
  listAgentReplies(input: WorktreeKeys): Effect.Effect<AgentReply[]>;
  insert(input: NewCommentThread): Effect.Effect<CommentThread>;
  append(input: CommentReply): Effect.Effect<CommentThread>;
  resolve(input: CommentResolution): Effect.Effect<CommentThread>;
  edit(input: CommentEdit): Effect.Effect<CommentThread>;
  removeMessage(input: CommentRemoval): Effect.Effect<CommentThread>;
  remove(input: CommentThreadKey): Effect.Effect<void>;
}

export const CommentStore = Context.Service<
  '@porcelain/reviews/CommentStore',
  CommentStore
>('@porcelain/reviews/CommentStore');
