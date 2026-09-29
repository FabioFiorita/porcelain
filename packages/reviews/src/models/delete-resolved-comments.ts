import type { CommentWriter } from './comment-thread.ts';

export type DeleteResolvedCommentsInput = {
  worktreeId: string;
  writer: CommentWriter;
};

export type DeleteResolvedCommentsResult = {
  deleted: string[];
  kept: number;
};
