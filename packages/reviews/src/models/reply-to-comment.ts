import type {
  CommentLimits,
  CommentThread,
  CommentWriter,
} from './comment-thread.ts';

export type ReplyToCommentInput = {
  worktreeId: string;
  threadId: string;
  messageId?: string | undefined;
  body: string;
  writer: CommentWriter;
};

export type ReplyToCommentResult = CommentThread;

export type ReplyToCommentOptions = CommentLimits;
