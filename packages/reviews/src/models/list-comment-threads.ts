import type { CommentThread, CommentThreadScope } from './comment-thread.ts';

export type ListCommentThreadsInput = {
  worktreeId?: string | undefined;
  reviewId?: string | undefined;
  scope?: CommentThreadScope | undefined;
};

export type ListCommentThreadsResult = readonly CommentThread[];
