import type {
  CommentAnchor,
  CommentThread,
  CommentWriter,
} from './comment-thread.ts';

export type CreateCommentThreadInput = {
  worktreeId: string;
  threadId?: string | undefined;
  messageId?: string | undefined;
  anchor: CommentAnchor;
  body: string;
  writer: CommentWriter;
};

export type CreateCommentThreadResult = CommentThread;
