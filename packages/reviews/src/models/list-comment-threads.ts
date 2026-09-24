import type { CommentThread, CommentThreadScope } from './comment-thread.ts';

export type ListCommentThreadsInput = {
  worktreeId: string;
  scope?: CommentThreadScope | undefined;
};

export type ListCommentThreadsResult = CommentThread[];
