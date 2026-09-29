import type { CommentThread, CommentWriter } from './comment-thread.ts';

export type EditCommentMessageInput = {
  worktreeId: string;
  threadId: string;
  messageId: string;
  body: string;
  writer: CommentWriter;
};

export type EditCommentMessageResult = {
  thread: CommentThread;
  changed: boolean;
};

export type EditCommentMessageOptions = { bytesPerWorktree: number };
