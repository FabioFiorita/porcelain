import type { CommentWriter } from './comment-thread.ts';

type ConfirmedCommentThread = {
  threadId: string;
  revision: number;
};

export type DeleteResolvedCommentsInput = {
  worktreeId: string;
  writer: CommentWriter;
  threads: readonly ConfirmedCommentThread[];
};

export type DeleteResolvedCommentsResult = {
  deleted: readonly string[];
  skipped: readonly string[];
};
