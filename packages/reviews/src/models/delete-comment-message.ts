import type { CommentThread, CommentWriter } from './comment-thread.ts';

export type DeleteCommentMessageInput = {
  worktreeId: string;
  threadId: string;
  messageId: string;
  writer: CommentWriter;
};

export type DeleteCommentMessageResult = {
  threadId: string;
  thread: CommentThread | undefined;
};
