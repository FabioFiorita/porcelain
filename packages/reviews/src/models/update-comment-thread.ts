import type { CommentThread } from './comment-thread.ts';

export type UpdateCommentThreadInput = {
  worktreeId: string;
  threadId: string;
  resolved: boolean;
};

export type UpdateCommentThreadResult = {
  thread: CommentThread;
  changed: boolean;
};
