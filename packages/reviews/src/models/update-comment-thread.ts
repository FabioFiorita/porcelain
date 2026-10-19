import type { CommentThread } from './comment-thread.ts';

export type UpdateCommentThreadInput = {
  reviewId?: string | undefined;
  worktreeId: string;
  threadId: string;
  resolved: boolean;
};

export type UpdateCommentThreadResult = {
  thread: CommentThread;
  changed: boolean;
};
