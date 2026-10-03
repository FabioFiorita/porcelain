import type { CommentWriter } from './comment-thread.ts';

type ConfirmedCommentThread = {
  threadId: string;
  revision: number;
};

export type DeleteResolvedCommentsInput = {
  worktreeId: string;
  writer: CommentWriter;
  threads: ConfirmedCommentThread[];
};

export type DeleteResolvedCommentsResult = {
  deleted: string[];
  skipped: string[];
};
